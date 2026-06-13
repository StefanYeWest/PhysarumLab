import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../model/SimulationEngine';
import { DEFAULT_CONFIG } from '../config/defaultConfig';
import type { Preset } from '../types/presets';

const SMALL_PRESET: Preset = {
  name: 'Тестовый',
  description: '',
  config: {
    ...DEFAULT_CONFIG,
    gridWidth: 60,
    gridHeight: 40,
    particleCount: 400,
    randomSeed: 5,
  },
  startArea: { x: 8, y: 20, radius: 4 },
  foodSources: [
    {
      id: 'f1',
      x: 50,
      y: 20,
      radius: 4,
      strength: 200,
      label: 'A',
      enabled: true,
    },
  ],
  walls: [],
};

describe('SimulationEngine — интеграция', () => {
  it('выполняет тики и формирует след', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(SMALL_PRESET);
    let trailBefore = 0;
    for (let i = 0; i < engine.world.trail.length; i++) {
      trailBefore += engine.world.trail[i];
    }
    expect(trailBefore).toBe(0);

    for (let i = 0; i < 50; i++) engine.tick();

    let trailAfter = 0;
    for (let i = 0; i < engine.world.trail.length; i++) {
      trailAfter += engine.world.trail[i];
    }
    expect(engine.tickNumber).toBe(50);
    expect(trailAfter).toBeGreaterThan(0);
  });

  it('детерминирован при одинаковом seed', () => {
    const run = () => {
      const e = new SimulationEngine();
      e.loadPreset(SMALL_PRESET);
      for (let i = 0; i < 30; i++) e.tick();
      return e.particles.map((p) => [p.x, p.y]);
    };
    expect(run()).toEqual(run());
  });

  it('строит A* и считает метрики после сравнения', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(SMALL_PRESET);
    const r = engine.compareWithAStar();
    expect(r.found).toBe(true);
    expect(engine.getMetrics().aStarPathLength).toBeGreaterThan(0);
  });

  it('сброс возвращает симуляцию в начальное состояние', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(SMALL_PRESET);
    for (let i = 0; i < 20; i++) engine.tick();
    expect(engine.tickNumber).toBe(20);
    engine.reset();
    expect(engine.tickNumber).toBe(0);
  });

  it('добавляет препятствие на маршрут и запускает замер восстановления', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(SMALL_PRESET);
    engine.compareWithAStar();
    const ok = engine.addObstacleOnRoute();
    expect(ok).toBe(true);
    // После блокировки появились новые стены на месте маршрута.
    let wallCount = 0;
    for (let i = 0; i < engine.world.cellTypes.length; i++) {
      if (engine.world.cellTypes[i] === 1) wallCount++;
    }
    expect(wallCount).toBeGreaterThan(0);
  });
});
