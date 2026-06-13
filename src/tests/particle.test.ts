import { describe, expect, it } from 'vitest';
import { WorldGrid } from '../model/WorldGrid';
import { PhysarumParticle } from '../model/PhysarumParticle';
import { SeededRandom } from '../algorithms/random';
import { DEFAULT_CONFIG } from '../config/defaultConfig';

describe('PhysarumParticle — поведение частицы', () => {
  it('перемещается в свободной среде в направлении угла', () => {
    const w = new WorldGrid(20, 20);
    const rng = new SeededRandom(1);
    const p = new PhysarumParticle(0, 5, 5, 0, 1); // угол 0 → вправо
    const moved = p.move(w, DEFAULT_CONFIG, rng);
    expect(moved).toBe(true);
    expect(p.x).toBeCloseTo(6, 5);
    expect(p.y).toBeCloseTo(5, 5);
    expect(p.stuckTicks).toBe(0);
  });

  it('не проходит сквозь стену и увеличивает stuckTicks', () => {
    const w = new WorldGrid(20, 20);
    w.addWall(6, 5);
    const rng = new SeededRandom(1);
    const p = new PhysarumParticle(0, 5, 5, 0, 1);
    const moved = p.move(w, DEFAULT_CONFIG, rng);
    expect(moved).toBe(false);
    expect(p.x).toBeCloseTo(5, 5); // осталась на месте
    expect(p.stuckTicks).toBe(1);
  });

  it('перерождается в стартовой области после долгого застревания', () => {
    const w = new WorldGrid(30, 30);
    w.setStartArea({ x: 15, y: 15, radius: 3 });
    // Окружаем частицу стенами, чтобы она гарантированно застряла.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        w.addWall(2 + dx, 2 + dy);
      }
    }
    const cfg = { ...DEFAULT_CONFIG, stuckParticleRespawnTicks: 3 };
    const rng = new SeededRandom(1);
    const p = new PhysarumParticle(0, 2, 2, 0, 1);
    for (let i = 0; i < 10; i++) p.move(w, cfg, rng);
    // После респауна частица должна оказаться рядом со стартовой областью.
    const dist = Math.hypot(p.x - 15, p.y - 15);
    expect(dist).toBeLessThanOrEqual(3.5);
  });

  it('оставляет след после движения', () => {
    const w = new WorldGrid(20, 20);
    w.setTrailMaxValue(255);
    const p = new PhysarumParticle(0, 5, 5, 0, 1);
    p.depositTrail(w, 10);
    expect(w.getTrailAt(5, 5)).toBeCloseTo(10, 5);
  });

  it('детерминирован при одинаковом seed', () => {
    const make = () => {
      const w = new WorldGrid(20, 20);
      const rng = new SeededRandom(99);
      const p = new PhysarumParticle(0, 10, 10, 0.5, 1);
      for (let i = 0; i < 20; i++) {
        p.senseAndTurn(w, DEFAULT_CONFIG, rng);
        p.move(w, DEFAULT_CONFIG, rng);
      }
      return { x: p.x, y: p.y, a: p.angleRadians };
    };
    expect(make()).toEqual(make());
  });
});
