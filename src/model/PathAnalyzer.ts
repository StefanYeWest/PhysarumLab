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
import { inBounds } from '../algorithms/gridMath';
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
   * Извлекает маршрут Physarum из карты следа (раздел 16.2).
   *
   * Используется A* со стоимостью входа в клетку, обратной силе следа:
   * движение по сильному следу почти бесплатно, по пустым клеткам —
   * дороже. Так маршрут идёт по сформированным «венам», но устойчив к
   * единичным разрывам тонкой вены. Маршрут считается реальной сетью
   * («сеть сформирована»), только если бóльшая часть его клеток проходит
   * по следу выше порога — иначе возвращается found = false.
   */
  extractPhysarumPath(
    world: WorldGrid,
    config: SimulationConfig,
    target: FoodSource,
    neighborhood: Neighborhood,
  ): PathResult {
    const threshold = config.trailThresholdForPath;
    const refMax = Math.max(threshold * 2, this.maxTrail(world));
    // Штраф за движение вне следа. Чем сильнее след в клетке, тем дешевле.
    const PENALTY = 6;
    const cellCost = (x: number, y: number): number => {
      const i = world.index(Math.floor(x), Math.floor(y));
      const t = world.cellTypes[i];
      if (t === CELL_CODE.start || t === CELL_CODE.food) return 1;
      const strength = Math.min(1, world.trail[i] / refMax);
      return 1 + PENALTY * (1 - strength);
    };

    const start = this.snapToWalkable(world, world.startArea);
    const goal = this.snapToWalkable(world, { x: target.x, y: target.y });
    const notFound: PathResult = {
      found: false,
      nodes: [],
      length: 0,
      visitedNodes: 0,
      calculationTimeMs: 0,
    };
    if (!start || !goal) return notFound;

    const result = aStar({
      width: world.width,
      height: world.height,
      isWalkable: (x, y) => world.isWalkable(x, y),
      start,
      goal,
      neighborhood,
      cellCost,
    });
    if (!result.found) return notFound;

    // Сеть считается сформированной, если достаточная доля клеток маршрута
    // проходит по следу выше порога (исключая диски старта и еды).
    const coverage = this.trailCoverage(world, result.nodes, threshold);
    if (coverage < 0.45) return notFound;

    return result;
  }

  /** Максимальное значение следа на карте (для нормализации стоимости). */
  private maxTrail(world: WorldGrid): number {
    let max = 0;
    const trail = world.trail;
    for (let i = 0; i < trail.length; i++) {
      if (trail[i] > max) max = trail[i];
    }
    return max;
  }

  /** Доля клеток маршрута, лежащих на следе выше порога. */
  private trailCoverage(
    world: WorldGrid,
    nodes: GridPoint[],
    threshold: number,
  ): number {
    let onTrail = 0;
    let counted = 0;
    for (const n of nodes) {
      const i = world.index(n.x, n.y);
      const type = world.cellTypes[i];
      // Клетки старта и еды не учитываем — там след может быть любым.
      if (type === CELL_CODE.start || type === CELL_CODE.food) continue;
      counted++;
      if (world.trail[i] >= threshold) onTrail++;
    }
    return counted === 0 ? 1 : onTrail / counted;
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
   * Сколько источников питания связаны со стартовой областью сформированной
   * сетью следа (раздел 16.4). Источник связан, если для него извлекается
   * маршрут Physarum с достаточным покрытием следом.
   */
  countConnectedFood(
    world: WorldGrid,
    config: SimulationConfig,
    neighborhood: Neighborhood = 8,
  ): number {
    const enabledFood = world.foodSources.filter((f) => f.enabled);
    if (enabledFood.length === 0) return 0;
    let connected = 0;
    for (const f of enabledFood) {
      if (this.extractPhysarumPath(world, config, f, neighborhood).found) {
        connected++;
      }
    }
    return connected;
  }

  /** Проверяет связность старта с конкретным источником (для восстановления). */
  isConnectedToFood(
    world: WorldGrid,
    config: SimulationConfig,
    food: FoodSource,
    neighborhood: Neighborhood = 8,
  ): boolean {
    return this.extractPhysarumPath(world, config, food, neighborhood).found;
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

  /** Находит ближайшую проходимую клетку к точке (для A*). */
  private snapToWalkable(world: WorldGrid, p: GridPoint): GridPoint | null {
    if (world.isWalkable(p.x, p.y)) {
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
    return this.spiralSearch(world, p, 6, (x, y) => world.isWalkable(x, y));
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
