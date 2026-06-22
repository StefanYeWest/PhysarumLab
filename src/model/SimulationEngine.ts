/**
 * SimulationEngine — главный класс управления симуляцией (раздел 6.2.1 ТЗ).
 *
 * Хранит мир, частицы и анализатор, управляет тиками, метриками,
 * сравнением с A*, извлечением маршрута Physarum, динамическими
 * препятствиями и экспортом данных. Не зависит от React.
 */
import type { SimulationConfig, Neighborhood } from '../types/simulation';
import type { FoodSource, StartArea } from '../types/grid';
import type {
  MetricsHistoryRow,
  PathResult,
  SimulationMetrics,
} from '../types/metrics';
import type { Preset } from '../types/presets';
import { WorldGrid } from './WorldGrid';
import { PhysarumParticle } from './PhysarumParticle';
import { PathAnalyzer } from './PathAnalyzer';
import { SeededRandom } from '../algorithms/random';
import { calculateEfficiency } from '../algorithms/metrics';
import { DEFAULT_CONFIG } from '../config/defaultConfig';
import { METRICS_RECALC_INTERVAL } from '../config/constants';

export class SimulationEngine {
  world: WorldGrid;
  particles: PhysarumParticle[] = [];
  readonly analyzer = new PathAnalyzer();

  config: SimulationConfig;
  private rng: SeededRandom;

  tickNumber = 0;
  running = false;
  fps = 0;

  /** Накопитель дробных тиков (для скоростей < 1x). */
  private tickAccumulator = 0;

  neighborhood: Neighborhood = 8;

  // Текущие отображаемые маршруты (FR-083, FR-093).
  aStarResult: PathResult | null = null;
  physarumResult: PathResult | null = null;
  selectedFoodId: string | null = null;

  // Состояние метрик во времени.
  private firstFoodFoundTick: number | null = null;
  private recoveryActive = false;
  private recoveryBroken = false;
  private recoveryStartTick = 0;
  private recoveryFoodId: string | null = null;
  private recoveryTimeTicks: number | null = null;

  private metrics: SimulationMetrics;
  private history: MetricsHistoryRow[] = [];

  /** Сохранённый preset для корректного сброса. */
  private currentPreset: Preset | null = null;

  constructor(config: SimulationConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
    this.rng = new SeededRandom(this.config.randomSeed);
    this.world = new WorldGrid(this.config.gridWidth, this.config.gridHeight);
    this.world.setTrailMaxValue(this.config.trailMaxValue);
    this.metrics = this.emptyMetrics();
    this.initParticles();
    this.world.refreshFoodCellTypes();
  }

  // --- Управление жизненным циклом ---

  start(): void {
    this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  /** Выполняет ровно один тик (FR-022). Пошаговый режим всегда на паузе. */
  step(): void {
    this.running = false;
    this.tick();
    this.updateMetrics(true);
  }

  /** Полный сброс к исходному состоянию текущего сценария (FR-023). */
  reset(): void {
    if (this.currentPreset) {
      this.loadPreset(this.currentPreset);
    } else {
      this.rebuildWorld();
    }
  }

  /**
   * Перезапуск роста: возвращает все частицы в стартовую область и очищает
   * след, но СОХРАНЯЕТ текущую карту (стены, еду, старт) и параметры. В отличие
   * от reset(), не перезагружает сценарий и не стирает пользовательские правки.
   * Состояние запуска (running) сохраняется. Воспроизводимо по seed.
   */
  restartParticles(): void {
    this.rng = new SeededRandom(this.config.randomSeed);
    this.initParticles();
    this.world.clearTrail();
    this.tickNumber = 0;
    this.tickAccumulator = 0;
    this.firstFoodFoundTick = null;
    this.recoveryActive = false;
    this.recoveryBroken = false;
    this.recoveryTimeTicks = null;
    this.aStarResult = null;
    this.physarumResult = null;
    this.history = [];
    this.metrics = this.emptyMetrics();
    this.updateMetrics(true);
  }

  /** Загрузка preset-сценария (FR-041). */
  loadPreset(preset: Preset): void {
    this.currentPreset = preset;
    this.config = { ...preset.config };
    this.rebuildWorld();

    this.world.setStartArea({ ...preset.startArea });
    this.world.foodSources = preset.foodSources.map((f) => ({ ...f }));
    for (const wall of preset.walls) {
      this.world.addWallRect(wall.x, wall.y, wall.width, wall.height);
    }
    this.world.refreshFoodCellTypes();
    this.initParticles();
    this.selectedFoodId = this.world.foodSources[0]?.id ?? null;
  }

  /** Пересоздаёт мир и сбрасывает состояние под текущий config. */
  private rebuildWorld(): void {
    const start = this.world?.startArea;
    const foods = this.world?.foodSources;
    this.world = new WorldGrid(
      this.config.gridWidth,
      this.config.gridHeight,
      start,
    );
    this.world.setTrailMaxValue(this.config.trailMaxValue);
    if (foods) this.world.foodSources = foods.map((f) => ({ ...f }));
    this.world.refreshFoodCellTypes();

    this.rng = new SeededRandom(this.config.randomSeed);
    this.tickNumber = 0;
    this.tickAccumulator = 0;
    this.firstFoodFoundTick = null;
    this.recoveryActive = false;
    this.recoveryBroken = false;
    this.recoveryTimeTicks = null;
    this.aStarResult = null;
    this.physarumResult = null;
    this.history = [];
    this.metrics = this.emptyMetrics();
    this.initParticles();
  }

  /** Создаёт частицы в стартовой области. */
  private initParticles(): void {
    const { particleCount, particleSpeed } = this.config;
    const start = this.world.startArea;
    this.particles = new Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const r = this.rng.next() * start.radius;
      const a = this.rng.angle();
      const x = start.x + Math.cos(a) * r;
      const y = start.y + Math.sin(a) * r;
      this.particles[i] = new PhysarumParticle(
        i,
        x,
        y,
        this.rng.angle(),
        particleSpeed,
      );
    }
  }

  // --- Основной цикл ---

  /** Один тик модели (раздел 10.2). */
  tick(): void {
    const { world, config, particles, rng } = this;

    world.updateFoodAttractionField(
      config.foodAttractionStrength,
      config.foodAttractionRadius,
    );

    for (const p of particles) {
      p.senseAndTurn(world, config, rng);
    }

    for (const p of particles) {
      const moved = p.move(world, config, rng);
      if (moved) {
        p.depositTrail(world, config.trailDepositAmount);
      }
    }

    world.evaporateTrail(config.trailEvaporationRate);
    world.diffuseTrail(config.trailDiffusionRate);

    this.detectFirstFood();

    this.tickNumber++;
  }

  /**
   * Продвигает симуляцию на dtTicks модельных тиков (учитывает скорость).
   * Возвращает число выполненных тиков. Метрики обновляются с троттлингом.
   */
  advance(speedMultiplier: number): number {
    if (!this.running) return 0;
    this.tickAccumulator += speedMultiplier;
    let executed = 0;
    // Ограничение, чтобы не зависнуть при больших dt.
    const maxTicks = 8;
    while (this.tickAccumulator >= 1 && executed < maxTicks) {
      this.tick();
      this.tickAccumulator -= 1;
      executed++;
      if (this.tickNumber % METRICS_RECALC_INTERVAL === 0) {
        this.updateMetrics(false);
        this.recordHistory();
      }
    }
    return executed;
  }

  /** Отмечает тик первого достижения источника питания. */
  private detectFirstFood(): void {
    if (this.firstFoodFoundTick !== null) return;
    const foods = this.world.foodSources.filter((f) => f.enabled);
    if (foods.length === 0) return;
    for (const p of this.particles) {
      for (const f of foods) {
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        if (dx * dx + dy * dy <= f.radius * f.radius) {
          this.firstFoodFoundTick = this.tickNumber;
          return;
        }
      }
    }
  }

  // --- Метрики ---

  setFps(fps: number): void {
    this.fps = fps;
    this.metrics.fps = fps;
  }

  getMetrics(): SimulationMetrics {
    return this.metrics;
  }

  getHistory(): MetricsHistoryRow[] {
    return this.history;
  }

  /** Пересчёт метрик (тяжёлые части троттлятся вызывающим). */
  updateMetrics(force: boolean): void {
    const { world, config, analyzer } = this;
    const walkable = world.countWalkableCells();
    const explored = analyzer.countExploredCells(world);
    const activeTrail = analyzer.countActiveTrailCells(
      world,
      config.trailThresholdForPath,
    );
    const totalFood = world.foodSources.filter((f) => f.enabled).length;
    const connectedFood = analyzer.countConnectedFood(world, config);

    // Проверка восстановления маршрута после препятствия (FR-103).
    // Сначала дожидаемся фактического разрыва сети (connected = false),
    // и только потом измеряем время до повторного соединения. Это
    // исключает «нулевое» восстановление, когда сеть не была разорвана.
    if (this.recoveryActive && this.recoveryFoodId) {
      const food = world.foodSources.find((f) => f.id === this.recoveryFoodId);
      const connected = food
        ? analyzer.isConnectedToFood(world, config, food)
        : false;
      if (!this.recoveryBroken) {
        if (!connected) this.recoveryBroken = true;
      } else if (connected) {
        this.recoveryTimeTicks = this.tickNumber - this.recoveryStartTick;
        this.recoveryActive = false;
      }
    }

    const m: SimulationMetrics = {
      tick: this.tickNumber,
      fps: this.fps,
      particleCount: this.particles.length,
      activeTrailCells: activeTrail,
      exploredCells: explored,
      exploredPercent: walkable > 0 ? (explored / walkable) * 100 : 0,
      connectedFoodCount: connectedFood,
      totalFoodCount: totalFood,
      firstFoodFoundTick: this.firstFoodFoundTick,
      aStarPathLength: this.aStarResult?.found
        ? this.aStarResult.length
        : null,
      physarumPathLength: this.physarumResult?.found
        ? this.physarumResult.length
        : null,
      routeDeviationPercent: this.computeDeviation(),
      routeEfficiency: this.computeEfficiency(),
      networkCost: this.physarumResult?.found
        ? this.physarumResult.length
        : null,
      recoveryTimeAfterObstacleTicks: this.recoveryTimeTicks,
    };
    this.metrics = m;
    if (force) this.recordHistory();
  }

  private computeDeviation(): number | null {
    if (!this.aStarResult?.found || !this.physarumResult?.found) return null;
    return this.analyzer.calculateDeviation(
      this.aStarResult.length,
      this.physarumResult.length,
    );
  }

  private computeEfficiency(): number | null {
    if (!this.aStarResult?.found || !this.physarumResult?.found) return null;
    return calculateEfficiency(
      this.aStarResult.length,
      this.physarumResult.length,
    );
  }

  private recordHistory(): void {
    const m = this.metrics;
    this.history.push({
      tick: m.tick,
      fps: m.fps,
      activeTrailCells: m.activeTrailCells,
      exploredPercent: m.exploredPercent,
      connectedFoodCount: m.connectedFoodCount,
      aStarPathLength: m.aStarPathLength,
      physarumPathLength: m.physarumPathLength,
      routeDeviationPercent: m.routeDeviationPercent,
      routeEfficiency: m.routeEfficiency,
    });
    // Ограничиваем размер истории, чтобы не расти бесконечно.
    if (this.history.length > 5000) {
      this.history.splice(0, this.history.length - 5000);
    }
  }

  // --- Сравнение с A* и извлечение маршрута ---

  /** Сравнение с A* для выбранного источника (FR-080..085). */
  compareWithAStar(foodId?: string): PathResult {
    const food = this.resolveFood(foodId);
    if (!food) {
      this.aStarResult = null;
      return this.emptyResult();
    }
    this.selectedFoodId = food.id;
    this.aStarResult = this.analyzer.buildAStarPath(
      this.world,
      food,
      this.neighborhood,
    );
    this.updateMetrics(true);
    return this.aStarResult;
  }

  /** Извлечение маршрута Physarum из карты следа (FR-090..094). */
  extractPhysarum(foodId?: string): PathResult {
    const food = this.resolveFood(foodId);
    if (!food) {
      this.physarumResult = null;
      return this.emptyResult();
    }
    this.selectedFoodId = food.id;
    this.physarumResult = this.analyzer.extractPhysarumPath(
      this.world,
      this.config,
      food,
      this.neighborhood,
    );
    this.updateMetrics(true);
    return this.physarumResult;
  }

  private resolveFood(foodId?: string): FoodSource | null {
    const id = foodId ?? this.selectedFoodId;
    const enabled = this.world.foodSources.filter((f) => f.enabled);
    if (id) {
      const found = enabled.find((f) => f.id === id);
      if (found) return found;
    }
    return enabled[0] ?? null;
  }

  // --- Динамические эксперименты ---

  /**
   * Добавляет препятствие поперёк текущего маршрута и запускает измерение
   * времени восстановления (FR-100..103).
   */
  addObstacleOnRoute(): boolean {
    const route = this.physarumResult?.found
      ? this.physarumResult.nodes
      : this.aStarResult?.found
        ? this.aStarResult.nodes
        : this.computeRouteForObstacle();
    if (!route || route.length < 5) return false;

    const midIdx = Math.floor(route.length / 2);
    const a = route[Math.max(0, midIdx - 2)];
    const b = route[Math.min(route.length - 1, midIdx + 2)];
    const mid = route[midIdx];

    // Направление вдоль маршрута и перпендикуляр к нему.
    const dirX = b.x - a.x;
    const dirY = b.y - a.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const perpX = -dirY / len;
    const perpY = dirX / len;

    const halfLength = 10;
    const thickness = 2;
    for (let t = -halfLength; t <= halfLength; t++) {
      for (let s = -thickness; s <= thickness; s++) {
        const x = Math.round(mid.x + perpX * t + (dirX / len) * s);
        const y = Math.round(mid.y + perpY * t + (dirY / len) * s);
        this.world.addWall(x, y);
      }
    }
    // Стена могла перекрыть клетки старта/еды — восстановим их метки.
    this.world.refreshFoodCellTypes();

    // Сбрасываем весь след: связность определяется по доле маршрута на следе,
    // поэтому локальный разрыв не нарушил бы её (широкий след даёт мгновенный
    // обход). Полный сброс делает замер восстановления осмысленным и
    // наглядным — сеть отрастает заново уже в обход новой стены (FR-100..103).
    this.world.clearTrail();

    const food = this.resolveFood();
    if (food) {
      // Перестраиваем A* (эталонный обход) и запускаем замер восстановления.
      this.aStarResult = this.analyzer.buildAStarPath(
        this.world,
        food,
        this.neighborhood,
      );
      this.recoveryActive = true;
      this.recoveryBroken = false;
      this.recoveryStartTick = this.tickNumber;
      this.recoveryFoodId = food.id;
      this.recoveryTimeTicks = null;
    }
    this.physarumResult = null;
    this.updateMetrics(true);
    return true;
  }

  private computeRouteForObstacle() {
    const food = this.resolveFood();
    if (!food) return null;
    const r = this.analyzer.buildAStarPath(this.world, food, this.neighborhood);
    return r.found ? r.nodes : null;
  }

  // --- Редактирование карты из UI ---

  paintWall(cx: number, cy: number, brushRadius: number, erase: boolean): void {
    this.world.paintWall(cx, cy, brushRadius, erase);
  }

  setStartArea(area: StartArea): void {
    this.world.setStartArea(area);
    // Частицы пересоздаются вокруг новой области (FR-033).
    this.initParticles();
  }

  addFoodSource(x: number, y: number): FoodSource {
    const id = `food-${Date.now()}-${Math.floor(this.rng.next() * 1000)}`;
    const label = `Food ${String.fromCharCode(65 + this.world.foodSources.length)}`;
    const food: FoodSource = {
      id,
      x,
      y,
      radius: 6,
      strength: 200,
      label,
      enabled: true,
    };
    this.world.addFood(food);
    if (!this.selectedFoodId) this.selectedFoodId = id;
    return food;
  }

  removeFood(id: string): void {
    this.world.removeFood(id);
    if (this.selectedFoodId === id) {
      this.selectedFoodId = this.world.foodSources[0]?.id ?? null;
    }
  }

  toggleFood(id: string, enabled: boolean): void {
    this.world.toggleFood(id, enabled);
  }

  clearWalls(): void {
    this.world.clearWalls();
    this.world.refreshFoodCellTypes();
  }

  clearTrail(): void {
    this.world.clearTrail();
  }

  clearAll(): void {
    this.world.clearWalls();
    this.world.clearTrail();
    this.world.foodSources = [];
    this.world.refreshFoodCellTypes();
    this.aStarResult = null;
    this.physarumResult = null;
    this.selectedFoodId = null;
  }

  /**
   * Применяет «живые» изменения конфигурации без сброса (FR-052).
   * Параметры, требующие сброса (размер сетки, число частиц, seed),
   * обрабатываются отдельно вызывающим кодом.
   */
  applyLiveConfig(patch: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...patch };
    this.world.setTrailMaxValue(this.config.trailMaxValue);
    if (patch.particleSpeed !== undefined) {
      for (const p of this.particles) p.speed = patch.particleSpeed;
    }
  }

  // --- Экспорт ---

  /** Меняет число частиц с пересозданием массива (сохраняет карту и след). */
  setParticleCount(count: number): void {
    this.config.particleCount = count;
    this.initParticles();
  }

  /** Меняет seed и переинициализирует генератор и частицы. */
  setSeed(seed: number): void {
    this.config.randomSeed = seed;
    this.rng = new SeededRandom(seed);
    this.initParticles();
  }

  exportMetricsJson(): SimulationMetrics {
    return { ...this.metrics };
  }

  // --- Вспомогательное ---

  private emptyResult(): PathResult {
    return {
      found: false,
      nodes: [],
      length: 0,
      visitedNodes: 0,
      calculationTimeMs: 0,
    };
  }

  private emptyMetrics(): SimulationMetrics {
    return {
      tick: 0,
      fps: 0,
      particleCount: this.config.particleCount,
      activeTrailCells: 0,
      exploredCells: 0,
      exploredPercent: 0,
      connectedFoodCount: 0,
      totalFoodCount: 0,
      firstFoodFoundTick: null,
      aStarPathLength: null,
      physarumPathLength: null,
      routeDeviationPercent: null,
      routeEfficiency: null,
      networkCost: null,
      recoveryTimeAfterObstacleTicks: null,
    };
  }
}
