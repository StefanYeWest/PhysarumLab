import { describe, expect, it } from 'vitest';
import { WorldGrid } from '../model/WorldGrid';

describe('WorldGrid — среда симуляции', () => {
  it('проверяет проходимость клеток и границы', () => {
    const w = new WorldGrid(10, 10);
    expect(w.isWalkable(5, 5)).toBe(true);
    expect(w.isWalkable(-1, 5)).toBe(false);
    expect(w.isWalkable(10, 5)).toBe(false);
    w.addWall(5, 5);
    expect(w.isWalkable(5, 5)).toBe(false);
  });

  it('добавляет и удаляет стены', () => {
    const w = new WorldGrid(10, 10);
    w.addWall(3, 3);
    expect(w.isWall(3, 3)).toBe(true);
    w.removeWall(3, 3);
    expect(w.isWall(3, 3)).toBe(false);
  });

  it('испаряет след по формуле trail *= (1 - rate)', () => {
    const w = new WorldGrid(5, 5);
    w.setTrailMaxValue(255);
    w.depositTrail(2, 2, 100);
    expect(w.getTrailAt(2, 2)).toBeCloseTo(100, 5);
    w.evaporateTrail(0.1);
    expect(w.getTrailAt(2, 2)).toBeCloseTo(90, 5);
  });

  it('обнуляет очень слабый след при испарении', () => {
    const w = new WorldGrid(5, 5);
    w.depositTrail(1, 1, 0.0005);
    w.evaporateTrail(0.5);
    expect(w.getTrailAt(1, 1)).toBe(0);
  });

  it('диффузия сглаживает след и сохраняет суммарную массу примерно', () => {
    const w = new WorldGrid(5, 5);
    w.setTrailMaxValue(255);
    w.depositTrail(2, 2, 90);
    const before = sumTrail(w);
    w.diffuseTrail(0.5);
    const after = sumTrail(w);
    // Соседние клетки получили часть значения.
    expect(w.getTrailAt(1, 2)).toBeGreaterThan(0);
    expect(w.getTrailAt(2, 2)).toBeLessThan(90);
    // Масса сохраняется (диффузия не создаёт и не уничтожает след).
    expect(after).toBeCloseTo(before, 1);
  });

  it('препятствия не накапливают след', () => {
    const w = new WorldGrid(5, 5);
    w.addWall(2, 2);
    w.depositTrail(2, 2, 100);
    expect(w.getTrailAt(2, 2)).toBe(0);
  });

  it('ограничивает след максимальным значением', () => {
    const w = new WorldGrid(5, 5);
    w.setTrailMaxValue(50);
    w.depositTrail(1, 1, 1000);
    expect(w.getTrailAt(1, 1)).toBe(50);
  });

  it('строит локальное пищевое поле, убывающее с расстоянием', () => {
    const w = new WorldGrid(40, 40);
    w.addFood({
      id: 'f1',
      x: 20,
      y: 20,
      radius: 4,
      strength: 200,
      label: 'A',
      enabled: true,
    });
    w.updateFoodAttractionField(200, 10);
    const center = w.getFoodAt(20, 20);
    const near = w.getFoodAt(24, 20);
    const far = w.getFoodAt(35, 20);
    expect(center).toBeGreaterThan(near);
    expect(far).toBe(0); // вне радиуса притяжения
  });
});

function sumTrail(w: WorldGrid): number {
  let s = 0;
  for (let i = 0; i < w.trail.length; i++) s += w.trail[i];
  return s;
}
