import { describe, expect, it } from 'vitest';
import {
  calculateDeviation,
  calculateEfficiency,
  calculateExploredPercent,
  calculatePathLength,
} from '../algorithms/metrics';
import { PathAnalyzer } from '../model/PathAnalyzer';
import { WorldGrid } from '../model/WorldGrid';
import { DEFAULT_CONFIG } from '../config/defaultConfig';

describe('Метрики маршрутов', () => {
  it('считает длину маршрута как сумму отрезков', () => {
    const len = calculatePathLength([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(len).toBeCloseTo(7, 5); // 3 + 4
  });

  it('длина пустого/одноточечного маршрута равна 0', () => {
    expect(calculatePathLength([])).toBe(0);
    expect(calculatePathLength([{ x: 1, y: 1 }])).toBe(0);
  });

  it('считает процент отклонения Physarum от A*', () => {
    // physarum = 110, aStar = 100 → +10%
    expect(calculateDeviation(100, 110)).toBeCloseTo(10, 5);
    expect(calculateDeviation(100, 100)).toBeCloseTo(0, 5);
  });

  it('считает эффективность маршрута', () => {
    expect(calculateEfficiency(100, 100)).toBeCloseTo(1, 5);
    expect(calculateEfficiency(100, 200)).toBeCloseTo(0.5, 5);
  });

  it('считает процент покрытия карты', () => {
    expect(calculateExploredPercent(50, 200)).toBeCloseTo(25, 5);
    expect(calculateExploredPercent(0, 0)).toBe(0);
  });
});

describe('PathAnalyzer — связность и извлечение маршрута', () => {
  it('строит A* до источника питания', () => {
    const w = new WorldGrid(40, 20);
    w.setStartArea({ x: 3, y: 10, radius: 2 });
    w.addFood({
      id: 'f1',
      x: 36,
      y: 10,
      radius: 3,
      strength: 200,
      label: 'A',
      enabled: true,
    });
    const analyzer = new PathAnalyzer();
    const r = analyzer.buildAStarPath(w, w.foodSources[0], 8);
    expect(r.found).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('извлекает маршрут Physarum по активной сети следа', () => {
    const w = new WorldGrid(40, 20);
    w.setTrailMaxValue(255);
    w.setStartArea({ x: 3, y: 10, radius: 2 });
    w.addFood({
      id: 'f1',
      x: 36,
      y: 10,
      radius: 3,
      strength: 200,
      label: 'A',
      enabled: true,
    });
    // Прокладываем «дорожку» из следа по прямой между стартом и едой.
    for (let x = 3; x <= 36; x++) {
      w.depositTrail(x, 10, 100);
    }
    const analyzer = new PathAnalyzer();
    const cfg = { ...DEFAULT_CONFIG, trailThresholdForPath: 30 };
    const r = analyzer.extractPhysarumPath(w, cfg, w.foodSources[0], 8);
    expect(r.found).toBe(true);

    const connected = analyzer.countConnectedFood(w, cfg);
    expect(connected).toBe(1);
  });

  it('не находит маршрут Physarum без сформированной сети', () => {
    const w = new WorldGrid(40, 20);
    w.setStartArea({ x: 3, y: 10, radius: 2 });
    w.addFood({
      id: 'f1',
      x: 36,
      y: 10,
      radius: 3,
      strength: 200,
      label: 'A',
      enabled: true,
    });
    const analyzer = new PathAnalyzer();
    const cfg = { ...DEFAULT_CONFIG, trailThresholdForPath: 30 };
    const r = analyzer.extractPhysarumPath(w, cfg, w.foodSources[0], 8);
    expect(r.found).toBe(false);
    expect(analyzer.countConnectedFood(w, cfg)).toBe(0);
  });
});
