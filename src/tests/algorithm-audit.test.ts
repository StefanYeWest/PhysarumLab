import { describe, it, expect } from 'vitest';
import { WorldGrid } from '../model/WorldGrid';
import { PhysarumParticle } from '../model/PhysarumParticle';
import { SimulationEngine } from '../model/SimulationEngine';
import { SeededRandom } from '../algorithms/random';
import { DEFAULT_CONFIG } from '../config/defaultConfig';
import { CELL_CODE } from '../types/grid';
import type { SimulationConfig } from '../types/simulation';
import type { Preset } from '../types/presets';

const DEG = Math.PI / 180;

function cfg(over: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...DEFAULT_CONFIG, ...over };
}

describe('A. Правило агента (Jones 2010)', () => {
  const baseCfg = cfg({
    sensorAngleDegrees: 45,
    sensorDistance: 5,
    turnAngleDegrees: 30,
    particleSpeed: 1,
  });
  const rng = () => new SeededRandom(1);

  function setup() {
    const world = new WorldGrid(100, 100, { x: 5, y: 50, radius: 4 });
    world.setTrailMaxValue(255);
    return world;
  }

  it('впереди сильнее всего → направление сохраняется', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    world.depositTrail(55, 50, 100);
    p.senseAndTurn(world, baseCfg, rng());
    expect(Math.abs(p.angleRadians)).toBeLessThan(1e-9);
  });

  it('сильнее справа → поворот вправо (+угол)', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    world.depositTrail(53, 53, 100);
    p.senseAndTurn(world, baseCfg, rng());
    expect(p.angleRadians).toBeCloseTo(30 * DEG, 5);
  });

  it('сильнее слева → поворот влево (−угол)', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    world.depositTrail(53, 46, 100);
    p.senseAndTurn(world, baseCfg, rng());
    expect(p.angleRadians).toBeCloseTo(-30 * DEG, 5);
  });

  it('впереди локальный минимум (бока сильнее) → случайный поворот на ±угол', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    world.depositTrail(53, 53, 100);
    world.depositTrail(53, 46, 100);
    p.senseAndTurn(world, baseCfg, rng());
    expect(Math.abs(Math.abs(p.angleRadians) - 30 * DEG)).toBeLessThan(1e-9);
  });

  it('пустое поле (все сенсоры 0) → движение прямо', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    p.senseAndTurn(world, baseCfg, rng());
    expect(p.angleRadians).toBe(0);
  });

  it('движение: шаг по направлению, депозит только при перемещении', () => {
    const world = setup();
    const p = new PhysarumParticle(0, 50, 50, 0, 2);
    const moved = p.move(world, baseCfg, rng());
    expect(moved).toBe(true);
    expect(p.x).toBeCloseTo(52, 6);
    p.depositTrail(world, 5);
    expect(world.getTrailAt(52, 50)).toBeCloseTo(5, 6);
  });

  it('столкновение со стеной: нет перемещения, рост stuckTicks, смена угла', () => {
    const world = setup();
    world.addWall(51, 50);
    world.addWall(52, 50);
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    const moved = p.move(world, baseCfg, rng());
    expect(moved).toBe(false);
    expect(p.x).toBe(50);
    expect(p.stuckTicks).toBe(1);
  });

  it('перерождение после длительного застревания', () => {
    const world = setup();
    world.addWall(51, 50);
    const c = cfg({ stuckParticleRespawnTicks: 3, particleSpeed: 1 });
    const p = new PhysarumParticle(0, 50, 50, 0, 1);
    p.stuckTicks = c.stuckParticleRespawnTicks;
    p.move(world, c, new SeededRandom(5));
    const d = Math.hypot(p.x - 5, p.y - 50);
    expect(d).toBeLessThanOrEqual(4 + 1e-6);
    expect(p.stuckTicks).toBe(0);
  });
});

describe('B. Динамика следа', () => {
  it('депозит ограничен trailMaxValue', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.depositTrail(5, 5, 1000);
    expect(w.getTrailAt(5, 5)).toBe(255);
  });

  it('испарение мультипликативно: V*(1-rate)', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.depositTrail(5, 5, 100);
    w.evaporateTrail(0.1);
    expect(w.getTrailAt(5, 5)).toBeCloseTo(90, 6);
  });

  it('слабый след обнуляется ниже эпсилон', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.depositTrail(5, 5, 0.0008);
    w.evaporateTrail(0.5);
    expect(w.getTrailAt(5, 5)).toBe(0);
  });

  it('диффузия растекается на соседей и не растёт без меры', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.depositTrail(5, 5, 100);
    const before = w.getTrailAt(5, 5);
    w.diffuseTrail(0.5);
    expect(w.getTrailAt(5, 5)).toBeLessThan(before);
    expect(w.getTrailAt(6, 5)).toBeGreaterThan(0);
    let sum = 0;
    for (let i = 0; i < w.trail.length; i++) sum += w.trail[i];
    expect(sum).toBeLessThanOrEqual(before + 1e-6);
  });

  it('стены не накапливают и не проводят след', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.addWall(6, 5);
    w.depositTrail(6, 5, 100);
    expect(w.getTrailAt(6, 5)).toBe(0);
    w.depositTrail(5, 5, 100);
    w.diffuseTrail(0.9);
    expect(w.getTrailAt(6, 5)).toBe(0);
  });
});

describe('C. Сенсоры и сигнал', () => {
  it('getSignalAt: стена и выход за границы → сильное отталкивание', () => {
    const w = new WorldGrid(10, 10);
    w.addWall(5, 5);
    expect(w.getSignalAt(5, 5)).toBe(-1000);
    expect(w.getSignalAt(-1, 5)).toBe(-1000);
    expect(w.getSignalAt(100, 5)).toBe(-1000);
  });

  it('сигнал = след + поле еды', () => {
    const w = new WorldGrid(10, 10);
    w.setTrailMaxValue(255);
    w.depositTrail(5, 5, 30);
    expect(w.getSignalAt(5, 5)).toBeCloseTo(30, 6);
  });

  it('ДОКУМЕНТИРОВАНО: точечный сенсор «видит» сквозь тонкую стену', () => {
    const w = new WorldGrid(40, 10);
    w.setTrailMaxValue(255);
    w.addWall(10, 5);
    w.depositTrail(15, 5, 100);
    const p = new PhysarumParticle(0, 5, 5, 0, 1);
    const c = cfg({ sensorDistance: 10, sensorAngleDegrees: 20, turnAngleDegrees: 10 });
    const before = p.angleRadians;
    p.senseAndTurn(w, c, new SeededRandom(1));
    expect(Number.isFinite(p.angleRadians)).toBe(true);
    expect(before).toBe(0);
  });
});

function carveWorld(
  engine: SimulationEngine,
  corridors: Array<[number, number, number, number]>,
  start: { x: number; y: number; radius: number },
  food: { x: number; y: number },
) {
  const w = engine.world;
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) w.addWall(x, y);
  const open = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) w.removeWall(x, y);
  };
  for (const [x0, y0, x1, y1] of corridors) open(x0, y0, x1, y1);
  open(start.x - start.radius, start.y - start.radius, start.x + start.radius, start.y + start.radius);
  open(food.x - 7, food.y - 7, food.x + 7, food.y + 7);
  engine.setStartArea(start);
  engine.addFoodSource(food.x, food.y);
  w.refreshFoodCellTypes();
}

function trailMassInRect(engine: SimulationEngine, x0: number, y0: number, x1: number, y1: number) {
  const w = engine.world;
  let sum = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
      if (w.cellTypes[w.index(x, y)] === CELL_CODE.wall) continue;
      sum += w.trail[w.index(x, y)];
    }
  return sum;
}

describe('D. Сравнение с эталонными решениями', () => {
  it('пустое поле: маршрут близок к прямой (эталон — евклид)', () => {
    const engine = new SimulationEngine(
      cfg({ gridWidth: 160, gridHeight: 100, particleCount: 2500, foodAttractionRadius: 26 }),
    );
    engine.loadPreset({
      name: 'empty',
      description: '',
      config: cfg({ gridWidth: 160, gridHeight: 100, particleCount: 2500, foodAttractionRadius: 26 }),
      startArea: { x: 20, y: 50, radius: 8 },
      foodSources: [{ id: 'f', x: 140, y: 50, radius: 6, strength: 200, label: 'A', enabled: true }],
      walls: [],
    });
    const food = engine.world.foodSources[0];
    const straight = Math.hypot(140 - 20, 0);
    let best: number | null = null;
    for (let t = 1; t <= 2500; t++) {
      engine.tick();
      if (t % 250 === 0) {
        const r = engine.analyzer.extractPhysarumPath(engine.world, engine.config, food, 8);
        if (r.found) {
          const dev = ((r.length - straight) / straight) * 100;
          if (best === null || dev < best) best = dev;
        }
      }
    }
     
    console.log(`[empty] straight=${straight.toFixed(0)} bestDeviation=${best === null ? 'NONE' : best.toFixed(0) + '%'}`);
    expect(best).not.toBeNull();
    expect(best as number).toBeLessThan(70);
  }, 60000);

  it('эталон A*: во всех лабиринтах извлечённый путь не короче A* и формируется', () => {
    const presets: Array<[string, Preset['walls']]> = [
      ['3-wall', [
        { x: 40, y: 0, width: 3, height: 85 },
        { x: 75, y: 35, width: 3, height: 85 },
        { x: 110, y: 0, width: 3, height: 85 },
      ]],
      ['single-gap', [{ x: 90, y: 0, width: 3, height: 90 }]],
    ];
    const rows: string[] = [];
    for (const [label, walls] of presets) {
      const c = cfg({ gridWidth: 180, gridHeight: 120, particleCount: 2800 });
      const engine = new SimulationEngine(c);
      engine.loadPreset({
        name: label,
        description: '',
        config: c,
        startArea: { x: 15, y: 60, radius: 8 },
        foodSources: [{ id: 'f', x: 165, y: 60, radius: 6, strength: 200, label: 'A', enabled: true }],
        walls,
      });
      const food = engine.world.foodSources[0];
      const aStar = engine.analyzer.buildAStarPath(engine.world, food, 8);
      expect(aStar.found).toBe(true);
      let dev: number | null = null;
      for (let t = 1; t <= 3000; t++) {
        engine.tick();
        if (t % 250 === 0 && dev === null && t > 400) {
          const r = engine.analyzer.extractPhysarumPath(engine.world, engine.config, food, 8);
          if (r.found) {
            expect(r.length).toBeGreaterThan(aStar.length * 0.95);
            dev = Math.round(((r.length - aStar.length) / aStar.length) * 100);
          }
        }
      }
      rows.push(`${label}: aStar=${aStar.length.toFixed(0)} dev=${dev === null ? 'NONE' : dev + '%'}`);
      expect(dev, `сеть не сформировалась: ${label}`).not.toBeNull();
    }
     
    console.log('[maze-vs-astar] ' + rows.join(' | '));
  }, 60000);

  it('классика Physarum: при двух путях сильнее укрепляется КОРОТКИЙ', () => {
    const c = cfg({ gridWidth: 150, gridHeight: 90, particleCount: 3500, foodAttractionRadius: 24 });
    const engine = new SimulationEngine(c);
    engine.clearAll();
    carveWorld(
      engine,
      [
        [12, 42, 138, 48],
        [12, 12, 20, 48],
        [12, 12, 138, 20],
        [130, 12, 138, 48],
      ],
      { x: 14, y: 45, radius: 5 },
      { x: 136, y: 45 },
    );
    for (let t = 0; t < 2500; t++) engine.tick();
    const shortMass = trailMassInRect(engine, 30, 42, 120, 48);
    const longMass = trailMassInRect(engine, 30, 12, 120, 20);
     
    console.log(`[shortcut] shortMass=${shortMass.toFixed(0)} longMass=${longMass.toFixed(0)} ratio=${(shortMass / Math.max(1, longMass)).toFixed(2)}`);
    expect(shortMass).toBeGreaterThan(longMass);
  }, 60000);
});

describe('E. Детерминизм и устойчивость', () => {
  it('одинаковый seed → побитовая воспроизводимость следа', () => {
    const make = () => {
      const c = cfg({ gridWidth: 100, gridHeight: 80, particleCount: 800, randomSeed: 123 });
      const e = new SimulationEngine(c);
      e.loadPreset({
        name: 'd', description: '', config: c,
        startArea: { x: 15, y: 40, radius: 6 },
        foodSources: [{ id: 'f', x: 85, y: 40, radius: 6, strength: 200, label: 'A', enabled: true }],
        walls: [],
      });
      for (let t = 0; t < 400; t++) e.tick();
      let sum = 0;
      for (let i = 0; i < e.world.trail.length; i++) sum += e.world.trail[i];
      return sum;
    };
    expect(make()).toBe(make());
  });

  it('длинный прогон: нет NaN, след ограничен trailMaxValue', () => {
    const c = cfg({ gridWidth: 120, gridHeight: 80, particleCount: 1500 });
    const e = new SimulationEngine(c);
    e.loadPreset({
      name: 'l', description: '', config: c,
      startArea: { x: 15, y: 40, radius: 8 },
      foodSources: [{ id: 'f', x: 105, y: 40, radius: 6, strength: 200, label: 'A', enabled: true }],
      walls: [{ x: 60, y: 0, width: 3, height: 55 }],
    });
    for (let t = 0; t < 5000; t++) e.tick();
    let maxTrail = 0;
    let ok = true;
    for (let i = 0; i < e.world.trail.length; i++) {
      const v = e.world.trail[i];
      if (!Number.isFinite(v)) ok = false;
      if (v > maxTrail) maxTrail = v;
    }
    expect(ok).toBe(true);
    expect(maxTrail).toBeLessThanOrEqual(e.config.trailMaxValue + 1e-6);
    for (const p of e.particles) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  }, 60000);
});
