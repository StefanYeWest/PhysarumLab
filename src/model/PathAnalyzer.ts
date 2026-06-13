/**
 * PathAnalyzer — класс анализа маршрутов (раздел 6.2.4, 16 ТЗ).
 *
 * Строит эталонный A*, извлекает маршрут Physarum из карты следа,
 * считает длины, отклонение, эффективность, покрытие карты и связность
 * сети с источниками питания.
 */
import type { SimulationConfig, Neighborhood } from '../types/simulation';
import type { FoodSource, GridPoint } from '../types/grid';
import type { PathResult } from '../types/metrics';
import { CELL_CODE } from '../types/grid';
import { aStar } from '../algorithms/astar';
import {
  calculateDeviation,
  calculatePathLength,
} from '../algorithms/metrics';
import { cellIndex, inBounds } from '../algorithms/gridMath';
import { EXPLORED_TRAIL_EPSILON } from '../config/constants';
import type { WorldGrid } from './WorldGrid';

export class PathAnalyzer {
  /** Эталонный маршрут A* от стартовой области до источника (раздел 15). */
  buildAStarPath(
    world: WorldGrid,
    target: FoodSource,
    neighborhood: Neighborhood,
  ): PathResult {
    const start = this.snapToWalkable(world, world.startArea);
    const goal = this.snapToWalkable(world, { x: target.x, y: target.y });
    if (!start || !goal) {
      return {
        found: false,
        nodes: [],
        length: 0,
        visitedNodes: 0,
        calculationTimeMs: 0,
      };
    }
    return aStar({
      width: world.width,
      height: world.height,
      isWalkable: (x, y) => world.isWalkable(x, y),
      start,
      goal,
      neighborhood,
    });
  }

  /**
   * Извлекает маршрут Physarum: кратчайший путь внутри активной сети
   * (клетки, где trail >= threshold) между стартом и источником (раздел 16.2).
   */
  extractPhysarumPath(
    world: WorldGrid,
    config: SimulationConfig,
    target: FoodSource,
    neighborhood: Neighborhood,
  ): PathResult {
    const threshold = config.trailThresholdForPath;
    const isActive = (x: number, y: number): boolean => {
      if (!world.isWalkable(x, y)) return false;
      const i = world.index(Math.floor(x), Math.floor(y));
      // Стартовые клетки и клетки источников всегда считаем коннекторами.
      const type = world.cellTypes[i];
      if (type === CELL_CODE.start || type === CELL_CODE.food) return true;
      return world.trail[i] >= threshold;
    };

    const start = this.snapToActive(world, world.startArea, isActive);
    const goal = this.snapToActive(
      world,
      { x: target.x, y: target.y },
      isActive,
      target.radius + 2,
    );
    if (!start || !goal) {
      return {
        found: false,
        nodes: [],
        length: 0,
        visitedNodes: 0,
        calculationTimeMs: 0,
      };
    }

    return aStar({
      width: world.width,
      height: world.height,
      isWalkable: isActive,
      start,
      goal,
      neighborhood,
    });
  }

  /** Длина маршрута (сумма евклидовых отрезков). */
  calculatePathLength(nodes: GridPoint[]): number {
    return calculatePathLength(nodes);
  }

  /** Процент отклонения Physarum от A*. */
  calculateDeviation(aStarLength: number, physarumLength: number): number {
    return calculateDeviation(aStarLength, physarumLength);
  }

  /** Число активных клеток следа (trail >= threshold). */
  countActiveTrailCells(world: WorldGrid, threshold: number): number {
    let count = 0;
    const trail = world.trail;
    const cells = world.cellTypes;
    for (let i = 0; i < trail.length; i++) {
      if (cells[i] === CELL_CODE.wall) continue;
      if (trail[i] >= threshold) count++;
    }
    return count;
  }

  /** Число исследованных клеток (есть хоть какой-то след). */
  countExploredCells(world: WorldGrid): number {
    let count = 0;
    const trail = world.trail;
    const cells = world.cellTypes;
    for (let i = 0; i < trail.length; i++) {
      if (cells[i] === CELL_CODE.wall) continue;
      if (trail[i] >= EXPLORED_TRAIL_EPSILON) count++;
    }
    return count;
  }

  /**
   * Сколько источников питания связаны со стартовой областью по активной
   * сети (BFS/flood fill по клеткам trail >= threshold). Раздел 16.4.
   */
  countConnectedFood(world: WorldGrid, config: SimulationConfig): number {
    const enabledFood = world.foodSources.filter((f) => f.enabled);
    if (enabledFood.length === 0) return 0;
    const reached = this.floodActiveFromStart(world, config);
    let connected = 0;
    for (const f of enabledFood) {
      if (this.isFoodReached(world, f, reached)) connected++;
    }
    return connected;
  }

  /** Проверяет связность старта с конкретным источником (для восстановления). */
  isConnectedToFood(
    world: WorldGrid,
    config: SimulationConfig,
    food: FoodSource,
  ): boolean {
    const reached = this.floodActiveFromStart(world, config);
    return this.isFoodReached(world, food, reached);
  }

  /**
   * Базовая сетевая оценка для нескольких источников: сумма длин A*-маршрутов
   * от старта до каждого включённого источника (раздел 16.4).
   * Это приближение, а не точное решение задачи Штейнера.
   */
  baselineNetworkCost(world: WorldGrid, neighborhood: Neighborhood): number | null {
    const enabled = world.foodSources.filter((f) => f.enabled);
    if (enabled.length === 0) return null;
    let total = 0;
    for (const f of enabled) {
      const r = this.buildAStarPath(world, f, neighborhood);
      if (!r.found) return null;
      total += r.length;
    }
    return total;
  }

  // --- Вспомогательные методы ---

  /** Flood fill по активной сети, начиная со стартовой области. */
  private floodActiveFromStart(
    world: WorldGrid,
    config: SimulationConfig,
  ): Uint8Array {
    const { width, height, trail, cellTypes } = world;
    const threshold = config.trailThresholdForPath;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    // Стартовые клетки — точки входа в обход.
    for (let i = 0; i < cellTypes.length; i++) {
      if (cellTypes[i] === CELL_CODE.start) {
        visited[i] = 1;
        queue.push(i);
      }
    }

    const isActive = (i: number): boolean => {
      const t = cellTypes[i];
      if (t === CELL_CODE.wall) return false;
      if (t === CELL_CODE.start || t === CELL_CODE.food) return true;
      return trail[i] >= threshold;
    };

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % width;
      const cy = (cur / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const ni = cellIndex(nx, ny, width);
          if (visited[ni]) continue;
          if (!isActive(ni)) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }
    return visited;
  }

  /** Достигнута ли клетка в радиусе источника обходом active-сети. */
  private isFoodReached(
    world: WorldGrid,
    food: FoodSource,
    reached: Uint8Array,
  ): boolean {
    const r = food.radius;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.round(food.x + dx);
        const y = Math.round(food.y + dy);
        if (!inBounds(x, y, world.width, world.height)) continue;
        if (reached[cellIndex(x, y, world.width)]) return true;
      }
    }
    return false;
  }

  /** Находит ближайшую проходимую клетку к точке (для A*). */
  private snapToWalkable(world: WorldGrid, p: GridPoint): GridPoint | null {
    if (world.isWalkable(p.x, p.y)) {
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
    return this.spiralSearch(world, p, 6, (x, y) => world.isWalkable(x, y));
  }

  /** Находит ближайшую активную клетку к точке. */
  private snapToActive(
    world: WorldGrid,
    p: GridPoint,
    isActive: (x: number, y: number) => boolean,
    maxRadius = 6,
  ): GridPoint | null {
    if (isActive(Math.round(p.x), Math.round(p.y))) {
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
    return this.spiralSearch(world, p, maxRadius, isActive);
  }

  private spiralSearch(
    world: WorldGrid,
    p: GridPoint,
    maxRadius: number,
    predicate: (x: number, y: number) => boolean,
  ): GridPoint | null {
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (!inBounds(x, y, world.width, world.height)) continue;
          if (predicate(x, y)) return { x, y };
        }
      }
    }
    return null;
  }
}
