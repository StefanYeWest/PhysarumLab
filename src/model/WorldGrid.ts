/**
 * WorldGrid — класс двумерной среды симуляции (раздел 6.2.2 ТЗ).
 *
 * Хранит типы клеток, карту следа, пищевое поле, стартовую область и
 * источники питания. Отвечает за проходимость, испарение и диффузию следа,
 * чтение сигналов в точках карты.
 */
import {
  CELL_CODE,
  type CellType,
  type FoodSource,
  type StartArea,
} from '../types/grid';
import { clamp } from '../utils/clamp';
import { cellIndex, inBounds } from '../algorithms/gridMath';
import { TRAIL_MIN_EPSILON } from '../config/constants';

export class WorldGrid {
  readonly width: number;
  readonly height: number;

  /** Тип каждой клетки (коды из CELL_CODE). */
  readonly cellTypes: Uint8Array;
  /** Карта следа (Float32Array для производительности, NFR-004). */
  readonly trail: Float32Array;
  /** Пищевое поле — локальное притяжение источников питания. */
  readonly foodField: Float32Array;

  /** Двойной буфер для диффузии (чтобы не аллоцировать каждый тик). */
  private readonly trailBuffer: Float32Array;

  startArea: StartArea;
  foodSources: FoodSource[] = [];

  private trailMaxValue = 255;

  constructor(width: number, height: number, startArea?: StartArea) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.cellTypes = new Uint8Array(size);
    this.trail = new Float32Array(size);
    this.foodField = new Float32Array(size);
    this.trailBuffer = new Float32Array(size);
    this.startArea = startArea ?? {
      x: Math.floor(width * 0.1),
      y: Math.floor(height / 2),
      radius: 6,
    };
  }

  /** Устанавливает максимальное значение следа (из конфига). */
  setTrailMaxValue(value: number): void {
    this.trailMaxValue = value;
  }

  index(x: number, y: number): number {
    return cellIndex(x, y, this.width);
  }

  // --- Типы клеток ---

  getCellType(x: number, y: number): CellType {
    const code = this.cellTypes[this.index(x, y)];
    return code === CELL_CODE.wall
      ? 'wall'
      : code === CELL_CODE.start
        ? 'start'
        : code === CELL_CODE.food
          ? 'food'
          : 'empty';
  }

  /** Клетка проходима, если она в границах и не является стеной. */
  isWalkable(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!inBounds(ix, iy, this.width, this.height)) return false;
    return this.cellTypes[this.index(ix, iy)] !== CELL_CODE.wall;
  }

  isWall(x: number, y: number): boolean {
    if (!inBounds(x, y, this.width, this.height)) return true;
    return this.cellTypes[this.index(x, y)] === CELL_CODE.wall;
  }

  // --- Стены ---

  addWall(x: number, y: number): void {
    if (!inBounds(x, y, this.width, this.height)) return;
    const i = this.index(x, y);
    this.cellTypes[i] = CELL_CODE.wall;
    // Препятствия не накапливают след (раздел 12.3, FR-038).
    this.trail[i] = 0;
    this.foodField[i] = 0;
  }

  removeWall(x: number, y: number): void {
    if (!inBounds(x, y, this.width, this.height)) return;
    const i = this.index(x, y);
    if (this.cellTypes[i] === CELL_CODE.wall) {
      this.cellTypes[i] = CELL_CODE.empty;
    }
  }

  /** Рисует прямоугольную стену (используется при загрузке preset). */
  addWallRect(x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.addWall(xx, yy);
      }
    }
  }

  /** Кистью рисует/стирает стену в радиусе brushRadius. */
  paintWall(cx: number, cy: number, brushRadius: number, erase: boolean): void {
    const r = Math.max(0, brushRadius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!inBounds(x, y, this.width, this.height)) continue;
        if (erase) {
          this.removeWall(x, y);
        } else {
          this.addWall(x, y);
        }
      }
    }
    // После стирания восстанавливаем метки старта/еды, которые могли
    // оказаться под стёртой стеной (иначе в диске остаётся «дыра»).
    if (erase) this.refreshFoodCellTypes();
  }

  clearWalls(): void {
    for (let i = 0; i < this.cellTypes.length; i++) {
      if (this.cellTypes[i] === CELL_CODE.wall) {
        this.cellTypes[i] = CELL_CODE.empty;
      }
    }
  }

  // --- След ---

  clearTrail(): void {
    this.trail.fill(0);
  }

  /** Очищает след внутри прямоугольной области (после блокировки маршрута). */
  clearTrailInRect(x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (!inBounds(xx, yy, this.width, this.height)) continue;
        this.trail[this.index(xx, yy)] = 0;
      }
    }
  }

  /** Добавляет след в клетку с ограничением по максимуму (раздел 11.3). */
  depositTrail(x: number, y: number, amount: number): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!inBounds(ix, iy, this.width, this.height)) return;
    const i = this.index(ix, iy);
    if (this.cellTypes[i] === CELL_CODE.wall) return;
    this.trail[i] = Math.min(this.trailMaxValue, this.trail[i] + amount);
  }

  /** Значение следа в клетке (билинейно не интерполируется, берём клетку). */
  getTrailAt(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!inBounds(ix, iy, this.width, this.height)) return 0;
    return this.trail[this.index(ix, iy)];
  }

  getFoodAt(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!inBounds(ix, iy, this.width, this.height)) return 0;
    return this.foodField[this.index(ix, iy)];
  }

  /**
   * Суммарный сигнал в точке: след + пищевое поле - штраф за стену
   * (раздел 11.1). Если точка вне карты или в стене — сильный штраф.
   */
  getSignalAt(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (!inBounds(ix, iy, this.width, this.height)) return -1000;
    const i = this.index(ix, iy);
    if (this.cellTypes[i] === CELL_CODE.wall) return -1000;
    return this.trail[i] + this.foodField[i];
  }

  /** Испарение следа: trail *= (1 - rate) (раздел 12.2). */
  evaporateTrail(rate: number): void {
    const factor = 1 - rate;
    const trail = this.trail;
    for (let i = 0; i < trail.length; i++) {
      let v = trail[i] * factor;
      if (v < TRAIL_MIN_EPSILON) v = 0;
      trail[i] = v;
    }
  }

  /**
   * Диффузия следа по окрестности 3x3 (раздел 12.3).
   * newTrail = trail*(1-rate) + neighborAverage*rate.
   * Стены не накапливают след и не участвуют как источники.
   */
  diffuseTrail(rate: number): void {
    if (rate <= 0) return;
    const { width, height, trail, trailBuffer, cellTypes } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (cellTypes[i] === CELL_CODE.wall) {
          trailBuffer[i] = 0;
          continue;
        }
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const ni = ny * width + nx;
            if (cellTypes[ni] === CELL_CODE.wall) continue;
            sum += trail[ni];
            count++;
          }
        }
        const avg = count > 0 ? sum / count : 0;
        const v = trail[i] * (1 - rate) + avg * rate;
        trailBuffer[i] = clamp(v, 0, this.trailMaxValue);
      }
    }
    trail.set(trailBuffer);
  }

  // --- Источники питания ---

  addFood(food: FoodSource): void {
    this.foodSources.push(food);
    this.markFoodCells();
  }

  removeFood(id: string): void {
    this.foodSources = this.foodSources.filter((f) => f.id !== id);
    this.refreshFoodCellTypes();
  }

  toggleFood(id: string, enabled: boolean): void {
    const food = this.foodSources.find((f) => f.id === id);
    if (food) food.enabled = enabled;
    this.refreshFoodCellTypes();
  }

  /** Ближайший включённый источник питания к точке (или null). */
  findFoodNear(x: number, y: number): FoodSource | null {
    let best: FoodSource | null = null;
    let bestDist = Infinity;
    for (const f of this.foodSources) {
      const dx = f.x - x;
      const dy = f.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  /** Помечает клетки источников питания как 'food' (для отрисовки/типов). */
  private markFoodCells(): void {
    this.refreshFoodCellTypes();
  }

  /** Перестраивает клетки-метки источников и стартовой области. */
  refreshFoodCellTypes(): void {
    // Сбрасываем старые метки food/start, не трогая стены.
    for (let i = 0; i < this.cellTypes.length; i++) {
      const c = this.cellTypes[i];
      if (c === CELL_CODE.food || c === CELL_CODE.start) {
        this.cellTypes[i] = CELL_CODE.empty;
      }
    }
    // Стартовая область.
    this.stampDisc(this.startArea.x, this.startArea.y, this.startArea.radius, CELL_CODE.start);
    // Источники питания.
    for (const f of this.foodSources) {
      if (!f.enabled) continue;
      this.stampDisc(f.x, f.y, f.radius, CELL_CODE.food);
    }
  }

  private stampDisc(cx: number, cy: number, radius: number, code: number): void {
    const r = Math.max(1, radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (!inBounds(x, y, this.width, this.height)) continue;
        const i = this.index(x, y);
        // Не перетираем стены.
        if (this.cellTypes[i] === CELL_CODE.wall) continue;
        this.cellTypes[i] = code;
      }
    }
  }

  /** Переносит стартовую область и обновляет метки клеток. */
  setStartArea(area: StartArea): void {
    this.startArea = area;
    this.refreshFoodCellTypes();
  }

  /**
   * Пересчитывает пищевое поле от всех включённых источников (раздел 13).
   * foodValue = strength * max(0, 1 - dist / radius). Поле локально.
   */
  updateFoodAttractionField(globalStrength: number, globalRadius: number): void {
    this.foodField.fill(0);
    for (const f of this.foodSources) {
      if (!f.enabled) continue;
      const radius = globalRadius;
      const strength = (f.strength / 200) * globalStrength;
      const minX = Math.max(0, Math.floor(f.x - radius));
      const maxX = Math.min(this.width - 1, Math.ceil(f.x + radius));
      const minY = Math.max(0, Math.floor(f.y - radius));
      const maxY = Math.min(this.height - 1, Math.ceil(f.y + radius));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const i = this.index(x, y);
          if (this.cellTypes[i] === CELL_CODE.wall) continue;
          const dist = Math.hypot(x - f.x, y - f.y);
          const value = strength * Math.max(0, 1 - dist / radius);
          if (value > this.foodField[i]) {
            this.foodField[i] = value;
          }
        }
      }
    }
  }

  /** Количество проходимых клеток (для расчёта покрытия). */
  countWalkableCells(): number {
    let count = 0;
    for (let i = 0; i < this.cellTypes.length; i++) {
      if (this.cellTypes[i] !== CELL_CODE.wall) count++;
    }
    return count;
  }
}
