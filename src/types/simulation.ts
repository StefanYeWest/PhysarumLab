/**
 * Типы конфигурации и состояния симуляции.
 */

/** Полная конфигурация модели симуляции. */
export interface SimulationConfig {
  gridWidth: number;
  gridHeight: number;
  cellSize: number;

  particleCount: number;
  particleSpeed: number;
  sensorDistance: number;
  sensorAngleDegrees: number;
  turnAngleDegrees: number;

  trailDepositAmount: number;
  trailEvaporationRate: number;
  trailDiffusionRate: number;
  trailMaxValue: number;

  foodAttractionStrength: number;
  foodAttractionRadius: number;

  simulationSpeed: number;
  randomSeed: number;

  trailThresholdForPath: number;
  stuckParticleRespawnTicks: number;
}

/** Сериализуемое состояние одной частицы. */
export interface ParticleState {
  id: number;
  x: number;
  y: number;
  angleRadians: number;
  speed: number;
  ageTicks: number;
  stuckTicks: number;
}

/** Режим соседства для A* и извлечения маршрута. */
export type Neighborhood = 4 | 8;
