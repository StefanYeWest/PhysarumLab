/**
 * Типы метрик симуляции и результатов анализа маршрутов.
 */

/** Сводные метрики симуляции для панели статистики (FR-070). */
export interface SimulationMetrics {
  tick: number;
  fps: number;
  particleCount: number;

  activeTrailCells: number;
  exploredCells: number;
  exploredPercent: number;

  connectedFoodCount: number;
  totalFoodCount: number;
  firstFoodFoundTick: number | null;

  aStarPathLength: number | null;
  physarumPathLength: number | null;
  routeDeviationPercent: number | null;
  routeEfficiency: number | null;

  networkCost: number | null;
  recoveryTimeAfterObstacleTicks: number | null;
}

/** Результат работы алгоритма поиска пути (A* / извлечение Physarum). */
export interface PathResult {
  found: boolean;
  nodes: Array<{ x: number; y: number }>;
  length: number;
  visitedNodes: number;
  calculationTimeMs: number;
}

/** Одна строка истории метрик (для экспорта в CSV). */
export interface MetricsHistoryRow {
  tick: number;
  fps: number;
  activeTrailCells: number;
  exploredPercent: number;
  connectedFoodCount: number;
  aStarPathLength: number | null;
  physarumPathLength: number | null;
  routeDeviationPercent: number | null;
  routeEfficiency: number | null;
}
