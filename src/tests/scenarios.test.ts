import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../model/SimulationEngine';
import { PathAnalyzer } from '../model/PathAnalyzer';
import { parsePreset, metricsHistoryToCsv } from '../utils/serialization';
import { DEFAULT_CONFIG } from '../config/defaultConfig';
import type { Preset } from '../types/presets';
import type { SimulationConfig } from '../types/simulation';
import emptyJson from '../../public/presets/empty.json';
import simpleMazeJson from '../../public/presets/simple-maze.json';
import doubleFoodJson from '../../public/presets/double-food.json';
import dynamicObstacleJson from '../../public/presets/dynamic-obstacle-demo.json';
import complexMazeJson from '../../public/presets/complex-maze.json';
import exhibitionJson from '../../public/presets/exhibition-demo.json';

const RAW_PRESETS: Record<string, unknown> = {
  'empty.json': emptyJson,
  'simple-maze.json': simpleMazeJson,
  'double-food.json': doubleFoodJson,
  'dynamic-obstacle-demo.json': dynamicObstacleJson,
  'complex-maze.json': complexMazeJson,
  'exhibition-demo.json': exhibitionJson,
};

const ALL_PRESET_FILES = Object.keys(RAW_PRESETS);

function loadPresetFromDisk(file: string): Preset {
  return parsePreset(RAW_PRESETS[file]);
}

function run(engine: SimulationEngine, ticks: number): void {
  for (let t = 0; t < ticks; t++) engine.tick();
}

describe('Пресеты: загрузка и валидность', () => {
  it('все JSON-пресеты парсятся без ошибок', () => {
    expect(ALL_PRESET_FILES.length).toBeGreaterThanOrEqual(5);
    for (const file of ALL_PRESET_FILES) {
      expect(() => loadPresetFromDisk(file)).not.toThrow();
    }
  });

  it('каждый пресет загружается в движок и стартует корректно', () => {
    for (const file of ALL_PRESET_FILES) {
      const preset = loadPresetFromDisk(file);
      const engine = new SimulationEngine();
      engine.loadPreset(preset);
      expect(engine.world.width).toBe(preset.config.gridWidth);
      expect(engine.world.height).toBe(preset.config.gridHeight);
      expect(engine.particles.length).toBe(preset.config.particleCount);
      expect(engine.world.startArea).toBeTruthy();
      run(engine, 50);
      for (const p of engine.particles) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});

describe('Пресеты: формирование сети и A*', () => {
  it('сценарии с едой соединяют старт и источник за разумное время', () => {
    const filesWithFood = [
      'exhibition-demo.json',
      'simple-maze.json',
      'complex-maze.json',
    ];
    for (const file of filesWithFood) {
      const preset = loadPresetFromDisk(file);
      const engine = new SimulationEngine();
      engine.loadPreset(preset);
      const food = engine.world.foodSources[0];
      const aStar = engine.analyzer.buildAStarPath(engine.world, food, 8);
      expect(aStar.found).toBe(true);
      let everConnected = false;
      for (let t = 0; t < 2500; t++) {
        engine.tick();
        if (t % 100 === 0 && t > 400) {
          if (engine.analyzer.countConnectedFood(engine.world, engine.config) >= 1) {
            everConnected = true;
            break;
          }
        }
      }
      expect(everConnected, `сеть не сформировалась в ${file}`).toBe(true);
    }
  }, 60000);

  it('double-food: оба источника учитываются', () => {
    const preset = loadPresetFromDisk('double-food.json');
    const engine = new SimulationEngine();
    engine.loadPreset(preset);
    expect(engine.world.foodSources.filter((f) => f.enabled).length).toBe(2);
    run(engine, 100);
    const m = engine.getMetrics();
    engine.updateMetrics(true);
    expect(engine.getMetrics().totalFoodCount).toBe(2);
    expect(m).toBeTruthy();
  });
});

describe('Жизненный цикл: start/pause/step/reset', () => {
  it('step продвигает ровно на один тик и ставит на паузу', () => {
    const engine = new SimulationEngine();
    engine.start();
    engine.step();
    expect(engine.running).toBe(false);
    expect(engine.tickNumber).toBe(1);
  });

  it('advance уважает паузу и множитель скорости', () => {
    const engine = new SimulationEngine();
    expect(engine.advance(4)).toBe(0); // на паузе ничего
    engine.start();
    const executed = engine.advance(4);
    expect(executed).toBe(4);
    expect(engine.tickNumber).toBe(4);
  });

  it('reset возвращает сценарий к начальному состоянию', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 200);
    expect(engine.tickNumber).toBe(200);
    engine.reset();
    expect(engine.tickNumber).toBe(0);
    expect(engine.getHistory().length).toBe(0);
    let sum = 0;
    for (let i = 0; i < engine.world.trail.length; i++) sum += engine.world.trail[i];
    expect(sum).toBe(0);
  });
});

describe('Инструменты карты', () => {
  it('рисование и стирание стены', () => {
    const engine = new SimulationEngine();
    engine.paintWall(50, 50, 2, false);
    expect(engine.world.isWall(50, 50)).toBe(true);
    engine.paintWall(50, 50, 2, true);
    expect(engine.world.isWall(50, 50)).toBe(false);
  });

  it('перенос стартовой области пересоздаёт частицы вокруг неё', () => {
    const engine = new SimulationEngine();
    engine.setStartArea({ x: 30, y: 30, radius: 8 });
    expect(engine.world.startArea.x).toBe(30);
    for (const p of engine.particles) {
      const d = Math.hypot(p.x - 30, p.y - 30);
      expect(d).toBeLessThanOrEqual(8 + 1e-6);
    }
  });

  it('добавление/удаление/переключение источника питания', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    const f = engine.addFoodSource(100, 60);
    expect(engine.world.foodSources.length).toBe(1);
    expect(engine.selectedFoodId).toBe(f.id);
    engine.toggleFood(f.id, false);
    expect(engine.world.foodSources[0].enabled).toBe(false);
    engine.removeFood(f.id);
    expect(engine.world.foodSources.length).toBe(0);
    expect(engine.selectedFoodId).toBeNull();
  });

  it('стирание стены восстанавливает метки старта/еды под ней', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    const sa = engine.world.startArea;
    engine.paintWall(sa.x, sa.y, 1, false);
    engine.paintWall(sa.x, sa.y, 1, true);
    expect(engine.world.getCellType(sa.x, sa.y)).toBe('start');
  });

  it('очистка стен/следа/всего', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 100);
    engine.clearTrail();
    let sum = 0;
    for (let i = 0; i < engine.world.trail.length; i++) sum += engine.world.trail[i];
    expect(sum).toBe(0);
    engine.clearWalls();
    expect(engine.world.countWalkableCells()).toBe(
      engine.world.width * engine.world.height,
    );
    engine.clearAll();
    expect(engine.world.foodSources.length).toBe(0);
  });
});

describe('Эксперименты: A*, извлечение, препятствие', () => {
  it('A* и извлечение Physarum после формирования сети', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 1500);
    const aStar = engine.compareWithAStar();
    expect(aStar.found).toBe(true);
    const phys = engine.extractPhysarum();
    if (phys.found) {
      expect(phys.length).toBeGreaterThan(aStar.length * 0.9);
      const m = engine.getMetrics();
      expect(m.routeDeviationPercent).not.toBeNull();
      expect(m.routeEfficiency).not.toBeNull();
    }
  });

  it('добавление препятствия на маршрут запускает замер восстановления', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 800);
    engine.compareWithAStar();
    const before = engine.world.countWalkableCells();
    const ok = engine.addObstacleOnRoute();
    expect(ok).toBe(true);
    expect(engine.world.countWalkableCells()).toBeLessThan(before);
    expect(engine.aStarResult?.found).toBe(true);
  });

  it('препятствие без маршрута возвращает false', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    expect(engine.addObstacleOnRoute()).toBe(false);
  });

  it('сеть восстанавливается после динамического препятствия', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('dynamic-obstacle-demo.json'));
    engine.start();
    for (let i = 0; i < 1000; i++) engine.advance(1);
    engine.compareWithAStar();
    expect(engine.addObstacleOnRoute()).toBe(true);
    expect(engine.getMetrics().connectedFoodCount).toBe(0);
    let reconnected = false;
    for (let i = 0; i < 3000; i++) {
      engine.advance(1);
      if (engine.getMetrics().recoveryTimeAfterObstacleTicks !== null) {
        reconnected = true;
        break;
      }
    }
    expect(reconnected, 'сеть не восстановилась после препятствия').toBe(true);
    expect(engine.getMetrics().recoveryTimeAfterObstacleTicks).toBeGreaterThan(0);
  });
});

describe('Параметры: live, particleCount, seed, детерминизм', () => {
  it('setParticleCount меняет число частиц', () => {
    const engine = new SimulationEngine();
    engine.setParticleCount(500);
    expect(engine.particles.length).toBe(500);
    expect(engine.config.particleCount).toBe(500);
  });

  it('applyLiveConfig применяет скорость ко всем частицам', () => {
    const engine = new SimulationEngine();
    engine.applyLiveConfig({ particleSpeed: 2.5 });
    for (const p of engine.particles) expect(p.speed).toBe(2.5);
  });

  it('одинаковый seed даёт идентичную траекторию', () => {
    const a = new SimulationEngine();
    const b = new SimulationEngine();
    a.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    b.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(a, 300);
    run(b, 300);
    expect(a.particles[0].x).toBe(b.particles[0].x);
    expect(a.particles[0].y).toBe(b.particles[0].y);
  });

  it('разные seed дают разные траектории', () => {
    const a = new SimulationEngine();
    a.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    a.setSeed(1);
    run(a, 300);
    const b = new SimulationEngine();
    b.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    b.setSeed(2);
    run(b, 300);
    const same = a.particles[0].x === b.particles[0].x;
    expect(same).toBe(false);
  });
});

describe('Краевые случаи', () => {
  it('сценарий без еды не падает и метрики корректны', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    run(engine, 100);
    engine.updateMetrics(true);
    const m = engine.getMetrics();
    expect(m.totalFoodCount).toBe(0);
    expect(m.connectedFoodCount).toBe(0);
    expect(m.firstFoodFoundTick).toBeNull();
    expect(engine.compareWithAStar().found).toBe(false);
    expect(engine.extractPhysarum().found).toBe(false);
  });

  it('полностью изолированная еда: A* не находит путь', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    engine.setStartArea({ x: 20, y: 60, radius: 6 });
    const f = engine.addFoodSource(150, 60);
    for (let y = 0; y < engine.world.height; y++) {
      engine.world.addWall(85, y);
    }
    const r = engine.analyzer.buildAStarPath(engine.world, f, 8);
    expect(r.found).toBe(false);
  });

  it('отключённая еда не учитывается в связности', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('double-food.json'));
    const f0 = engine.world.foodSources[0];
    engine.toggleFood(f0.id, false);
    run(engine, 50);
    expect(engine.analyzer.countConnectedFood(engine.world, engine.config)).toBeLessThanOrEqual(1);
  });

  it('экстремальные параметры не приводят к NaN', () => {
    const configs: Partial<SimulationConfig>[] = [
      { trailEvaporationRate: 0, trailDiffusionRate: 0 },
      { trailEvaporationRate: 0.2, trailDiffusionRate: 1 },
      { sensorDistance: 15, sensorAngleDegrees: 90, turnAngleDegrees: 90 },
      { particleSpeed: 3 },
    ];
    for (const patch of configs) {
      const engine = new SimulationEngine({ ...DEFAULT_CONFIG, ...patch, particleCount: 300 });
      engine.loadPreset({
        name: 't',
        description: '',
        config: { ...DEFAULT_CONFIG, ...patch, particleCount: 300 },
        startArea: { x: 20, y: 60, radius: 8 },
        foodSources: [
          { id: 'f', x: 150, y: 60, radius: 6, strength: 200, label: 'A', enabled: true },
        ],
        walls: [],
      });
      run(engine, 80);
      for (const p of engine.particles) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      let trailFinite = true;
      for (let i = 0; i < engine.world.trail.length; i++) {
        if (!Number.isFinite(engine.world.trail[i])) trailFinite = false;
      }
      expect(trailFinite).toBe(true);
    }
  });

  it('particleCount = 1 работает', () => {
    const engine = new SimulationEngine({ ...DEFAULT_CONFIG, particleCount: 1 });
    run(engine, 50);
    expect(engine.particles.length).toBe(1);
  });

  it('старт совпадает с едой: путь нулевой, без падений', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    engine.setStartArea({ x: 90, y: 60, radius: 6 });
    const f = engine.addFoodSource(90, 60);
    run(engine, 30);
    const a = engine.analyzer.buildAStarPath(engine.world, f, 8);
    expect(a.found).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(a.length)).toBe(true);
  });

  it('инструмент инспекции возвращает значения следа и поля', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 100);
    const trail = engine.world.getTrailAt(30, 60);
    const food = engine.world.getFoodAt(30, 60);
    expect(Number.isFinite(trail)).toBe(true);
    expect(Number.isFinite(food)).toBe(true);
    expect(trail).toBeGreaterThanOrEqual(0);
  });
});

describe('Экспорт данных', () => {
  it('CSV истории формируется и имеет заголовок + строки', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    engine.start();
    for (let i = 0; i < 100; i++) engine.advance(1);
    const csv = metricsHistoryToCsv(engine.getHistory());
    const lines = csv.split('\n');
    expect(lines[0]).toContain('tick,fps');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('exportMetricsJson возвращает копию метрик', () => {
    const engine = new SimulationEngine();
    const j = engine.exportMetricsJson();
    expect(j).toHaveProperty('tick');
    expect(j).toHaveProperty('connectedFoodCount');
  });

  it('parsePreset бросает понятные ошибки на некорректных данных', () => {
    expect(() => parsePreset(null)).toThrow();
    expect(() => parsePreset({})).toThrow();
    expect(() => parsePreset({ name: 'x' })).toThrow();
    expect(() => parsePreset({ name: 'x', config: {}, startArea: {}, foodSources: {}, walls: [] })).toThrow();
  });

  it('round-trip: экспортированные стены восстанавливаются', () => {
    const engine = new SimulationEngine();
    engine.clearAll();
    engine.paintWall(40, 40, 2, false);
    const wallCount = engine.world.countWalkableCells();
    const walls: { x: number; y: number; width: number; height: number }[] = [];
    for (let y = 0; y < engine.world.height; y++) {
      for (let x = 0; x < engine.world.width; x++) {
        if (engine.world.isWall(x, y)) walls.push({ x, y, width: 1, height: 1 });
      }
    }
    const engine2 = new SimulationEngine();
    engine2.loadPreset({
      name: 'rt',
      description: '',
      config: { ...DEFAULT_CONFIG },
      startArea: { x: 20, y: 60, radius: 8 },
      foodSources: [],
      walls,
    });
    expect(engine2.world.countWalkableCells()).toBe(wallCount);
  });
});

describe('PathAnalyzer: метрики', () => {
  it('exploredPercent в диапазоне 0..100', () => {
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 300);
    engine.updateMetrics(true);
    const m = engine.getMetrics();
    expect(m.exploredPercent).toBeGreaterThanOrEqual(0);
    expect(m.exploredPercent).toBeLessThanOrEqual(100);
  });

  it('countActiveTrailCells не превышает число проходимых клеток', () => {
    const analyzer = new PathAnalyzer();
    const engine = new SimulationEngine();
    engine.loadPreset(loadPresetFromDisk('exhibition-demo.json'));
    run(engine, 300);
    const active = analyzer.countActiveTrailCells(engine.world, engine.config.trailThresholdForPath);
    expect(active).toBeLessThanOrEqual(engine.world.countWalkableCells());
  });
});
