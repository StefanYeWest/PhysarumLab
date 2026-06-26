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

export interface PathResult {
  found: boolean;
  nodes: Array<{ x: number; y: number }>;
  length: number;
  visitedNodes: number;
  calculationTimeMs: number;
}

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
