/**
 * useSimulation — связующий хук между моделью (SimulationEngine) и UI.
 *
 * Владеет экземпляром движка и рендерера, запускает цикл
 * requestAnimationFrame, зеркалирует состояние модели в React-state для
 * перерисовки панелей и предоставляет действия для компонентов.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SimulationEngine } from '../model/SimulationEngine';
import {
  CanvasRenderer,
  DEFAULT_LAYERS,
  type LayerVisibility,
} from '../rendering/CanvasRenderer';
import type { SimulationConfig } from '../types/simulation';
import type { SimulationMetrics } from '../types/metrics';
import type { FoodSource } from '../types/grid';
import { DEFAULT_CONFIG, type ConfigParamKey } from '../config/defaultConfig';
import { PRESETS_BASE_PATH } from '../config/constants';
import { parsePreset, metricsHistoryToCsv } from '../utils/serialization';
import { downloadCsv, downloadJson } from '../utils/download';

/** Инструменты редактирования карты (FR-030). */
export type Tool =
  | 'view'
  | 'start'
  | 'food'
  | 'wall'
  | 'erase'
  | 'destroy'
  | 'inspect';

export interface UiState {
  running: boolean;
  tick: number;
  fps: number;
  speed: number;
  metrics: SimulationMetrics;
  config: SimulationConfig;
  foodSources: FoodSource[];
  selectedFoodId: string | null;
  layers: LayerVisibility;
  tool: Tool;
  brushSize: number;
  presetName: string;
  message: { kind: 'info' | 'error' | 'ok'; text: string } | null;
  inspected: { x: number; y: number; trail: number; food: number } | null;
}

const UI_REFRESH_MS = 150;

export function useSimulation() {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(DEFAULT_CONFIG);
  }
  const engine = engineRef.current;

  const rendererRef = useRef<CanvasRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const layersRef = useRef<LayerVisibility>({ ...DEFAULT_LAYERS });
  const speedRef = useRef<number>(1);

  const [ui, setUi] = useState<UiState>(() => ({
    running: false,
    tick: 0,
    fps: 0,
    speed: 1,
    metrics: engine.getMetrics(),
    config: { ...engine.config },
    foodSources: engine.world.foodSources.map((f) => ({ ...f })),
    selectedFoodId: engine.selectedFoodId,
    layers: { ...DEFAULT_LAYERS },
    tool: 'wall',
    brushSize: 2,
    presetName: 'Выставочная демонстрация',
    message: null,
    inspected: null,
  }));

  /** Зеркалирует текущее состояние движка в React-state. */
  const syncUi = useCallback(
    (patch?: Partial<UiState>) => {
      setUi((prev) => ({
        ...prev,
        running: engine.running,
        tick: engine.tickNumber,
        fps: engine.fps,
        metrics: engine.getMetrics(),
        config: { ...engine.config },
        foodSources: engine.world.foodSources.map((f) => ({ ...f })),
        selectedFoodId: engine.selectedFoodId,
        ...patch,
      }));
    },
    [engine],
  );

  // Цикл анимации: считает FPS, продвигает модель, перерисовывает.
  useEffect(() => {
    let lastTime = performance.now();
    let lastUiSync = 0;
    let frameCount = 0;
    let fpsAccum = 0;

    const frame = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 500) {
        const fps = (frameCount / fpsAccum) * 1000;
        engine.setFps(Math.round(fps));
        frameCount = 0;
        fpsAccum = 0;
      }

      if (engine.running) {
        engine.advance(speedRef.current);
      }

      const renderer = rendererRef.current;
      if (renderer) {
        renderer.render(engine, layersRef.current);
      }

      if (now - lastUiSync >= UI_REFRESH_MS) {
        lastUiSync = now;
        syncUi();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine, syncUi]);

  /** Подключает Canvas-элемент и создаёт рендерер. */
  const attachCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) {
        rendererRef.current = null;
        return;
      }
      const renderer = new CanvasRenderer(canvas);
      renderer.resize(
        engine.world.width,
        engine.world.height,
        engine.config.cellSize,
      );
      rendererRef.current = renderer;
    },
    [engine],
  );

  const flashMessage = useCallback(
    (kind: 'info' | 'error' | 'ok', text: string) => {
      setUi((prev) => ({ ...prev, message: { kind, text } }));
    },
    [],
  );

  // --- Действия управления ---

  const start = useCallback(() => {
    engine.start();
    syncUi();
  }, [engine, syncUi]);

  const pause = useCallback(() => {
    engine.pause();
    syncUi();
  }, [engine, syncUi]);

  const step = useCallback(() => {
    engine.pause();
    engine.step();
    syncUi();
  }, [engine, syncUi]);

  const reset = useCallback(() => {
    engine.reset();
    rendererRef.current?.resize(
      engine.world.width,
      engine.world.height,
      engine.config.cellSize,
    );
    syncUi({ message: null, inspected: null });
  }, [engine, syncUi]);

  /** Вернуть частицы в старт и перезапустить рост, сохранив карту и параметры. */
  const restartParticles = useCallback(() => {
    engine.restartParticles();
    syncUi({
      message: {
        kind: 'info',
        text: 'Частицы возвращены в старт. Карта и параметры сохранены.',
      },
      inspected: null,
    });
  }, [engine, syncUi]);

  const setSpeed = useCallback(
    (speed: number) => {
      speedRef.current = speed;
      engine.config.simulationSpeed = speed;
      setUi((prev) => ({ ...prev, speed }));
    },
    [engine],
  );

  // --- Preset ---

  const loadPresetById = useCallback(
    async (file: string, title: string) => {
      try {
        const res = await fetch(`${PRESETS_BASE_PATH}${file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const preset = parsePreset(raw);
        engine.pause();
        engine.loadPreset(preset);
        speedRef.current = preset.config.simulationSpeed;
        rendererRef.current?.resize(
          engine.world.width,
          engine.world.height,
          engine.config.cellSize,
        );
        syncUi({
          presetName: preset.name,
          speed: preset.config.simulationSpeed,
          message: { kind: 'ok', text: `Загружен сценарий: ${preset.name}` },
          inspected: null,
        });
      } catch (e) {
        flashMessage(
          'error',
          `Не удалось загрузить сценарий «${title}»: ${(e as Error).message}`,
        );
      }
    },
    [engine, syncUi, flashMessage],
  );

  const importPreset = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const preset = parsePreset(JSON.parse(text));
        engine.pause();
        engine.loadPreset(preset);
        speedRef.current = preset.config.simulationSpeed;
        rendererRef.current?.resize(
          engine.world.width,
          engine.world.height,
          engine.config.cellSize,
        );
        syncUi({
          presetName: preset.name,
          message: { kind: 'ok', text: `Импортирован сценарий: ${preset.name}` },
        });
      } catch (e) {
        flashMessage(
          'error',
          `Ошибка импорта сценария: ${(e as Error).message}`,
        );
      }
    },
    [engine, syncUi, flashMessage],
  );

  const exportPreset = useCallback(() => {
    const w = engine.world;
    const preset = {
      name: ui.presetName || 'Пользовательский сценарий',
      description: 'Экспортировано из Physarum Lab',
      config: { ...engine.config },
      startArea: { ...w.startArea },
      foodSources: w.foodSources.map((f) => ({ ...f })),
      walls: extractWalls(engine),
    };
    downloadJson('physarum-scenario.json', preset);
    flashMessage('ok', 'Сценарий экспортирован в JSON.');
  }, [engine, ui.presetName, flashMessage]);

  // --- Параметры ---

  const setParam = useCallback(
    (key: ConfigParamKey, value: number) => {
      if (key === 'particleCount') {
        engine.setParticleCount(value);
      } else if (key === 'randomSeed') {
        engine.setSeed(value);
      } else {
        engine.applyLiveConfig({ [key]: value });
      }
      syncUi();
    },
    [engine, syncUi],
  );

  const resetParams = useCallback(() => {
    // Сбрасываем параметры модели к значениям по умолчанию, но сохраняем
    // геометрию текущего сценария (размер сетки и клетки), иначе мир и
    // конфиг рассинхронизируются.
    const { gridWidth, gridHeight, cellSize } = engine.config;
    engine.applyLiveConfig({ ...DEFAULT_CONFIG, gridWidth, gridHeight, cellSize });
    engine.setSeed(DEFAULT_CONFIG.randomSeed);
    engine.setParticleCount(DEFAULT_CONFIG.particleCount);
    syncUi({ message: { kind: 'info', text: 'Параметры сброшены к значениям по умолчанию.' } });
  }, [engine, syncUi]);

  // --- Слои ---

  const setLayer = useCallback((key: keyof LayerVisibility, value: boolean) => {
    layersRef.current = { ...layersRef.current, [key]: value };
    setUi((prev) => ({ ...prev, layers: { ...layersRef.current } }));
  }, []);

  // --- Инструменты ---

  const setTool = useCallback((tool: Tool) => {
    setUi((prev) => ({ ...prev, tool }));
  }, []);

  const setBrushSize = useCallback((brushSize: number) => {
    setUi((prev) => ({ ...prev, brushSize }));
  }, []);

  /** Применяет текущий инструмент в клетке карты (вызывается из Canvas). */
  const applyToolAt = useCallback(
    (cellX: number, cellY: number, toolOverride?: Tool) => {
      const tool = toolOverride ?? ui.tool;
      switch (tool) {
        case 'wall':
          engine.paintWall(cellX, cellY, ui.brushSize, false);
          break;
        case 'erase':
          engine.paintWall(cellX, cellY, ui.brushSize, true);
          break;
        case 'destroy':
          engine.world.clearTrailInRect(
            cellX - ui.brushSize,
            cellY - ui.brushSize,
            ui.brushSize * 2,
            ui.brushSize * 2,
          );
          break;
        case 'start':
          engine.setStartArea({
            x: cellX,
            y: cellY,
            radius: engine.world.startArea.radius,
          });
          syncUi();
          break;
        case 'food':
          engine.addFoodSource(cellX, cellY);
          syncUi();
          break;
        case 'inspect': {
          const trail = engine.world.getTrailAt(cellX, cellY);
          const food = engine.world.getFoodAt(cellX, cellY);
          setUi((prev) => ({
            ...prev,
            inspected: { x: cellX, y: cellY, trail, food },
          }));
          break;
        }
        default:
          break;
      }
    },
    [engine, ui.tool, ui.brushSize, syncUi],
  );

  // --- Источники питания ---

  const selectFood = useCallback(
    (id: string) => {
      engine.selectedFoodId = id;
      syncUi();
    },
    [engine, syncUi],
  );

  const toggleFood = useCallback(
    (id: string, enabled: boolean) => {
      engine.toggleFood(id, enabled);
      syncUi();
    },
    [engine, syncUi],
  );

  const removeFood = useCallback(
    (id: string) => {
      engine.removeFood(id);
      syncUi();
    },
    [engine, syncUi],
  );

  // --- Анализ ---

  const compareAStar = useCallback(() => {
    const food = engine.world.foodSources.find(
      (f) => f.id === (engine.selectedFoodId ?? ''),
    );
    if (!food && engine.world.foodSources.filter((f) => f.enabled).length === 0) {
      flashMessage('error', 'Нет источников питания для сравнения.');
      return;
    }
    const result = engine.compareWithAStar();
    if (!result.found) {
      flashMessage('error', 'Путь невозможен: цель отделена препятствиями.');
    } else {
      flashMessage(
        'ok',
        `A* построен: длина ${result.length.toFixed(1)}, узлов ${result.nodes.length}.`,
      );
    }
    syncUi();
  }, [engine, syncUi, flashMessage]);

  const extractPhysarum = useCallback(() => {
    const result = engine.extractPhysarum();
    if (!result.found) {
      flashMessage('error', 'Сеть ещё не сформирована.');
    } else {
      flashMessage(
        'ok',
        `Маршрут Physarum извлечён: длина ${result.length.toFixed(1)}.`,
      );
    }
    syncUi();
  }, [engine, syncUi, flashMessage]);

  const addObstacle = useCallback(() => {
    const ok = engine.addObstacleOnRoute();
    if (!ok) {
      flashMessage(
        'error',
        'Нет маршрута для блокировки. Сначала постройте A* или дождитесь сети.',
      );
    } else {
      flashMessage('info', 'Препятствие добавлено. Идёт замер восстановления…');
    }
    syncUi();
  }, [engine, syncUi, flashMessage]);

  // --- Очистка карты ---

  const clearWalls = useCallback(() => {
    engine.clearWalls();
    syncUi();
  }, [engine, syncUi]);

  const clearTrail = useCallback(() => {
    engine.clearTrail();
    syncUi();
  }, [engine, syncUi]);

  const clearAll = useCallback(() => {
    engine.clearAll();
    syncUi();
  }, [engine, syncUi]);

  // --- Экспорт данных ---

  const exportMetricsJson = useCallback(() => {
    downloadJson('physarum-metrics.json', engine.exportMetricsJson());
    flashMessage('ok', 'Метрики экспортированы в JSON.');
  }, [engine, flashMessage]);

  const exportCsv = useCallback(() => {
    const history = engine.getHistory();
    if (history.length === 0) {
      flashMessage('error', 'История метрик пуста. Запустите симуляцию.');
      return;
    }
    downloadCsv('physarum-history.csv', metricsHistoryToCsv(history));
    flashMessage('ok', `Экспортировано ${history.length} строк в CSV.`);
  }, [engine, flashMessage]);

  // Начальная загрузка выставочного сценария.
  useEffect(() => {
    void loadPresetById('exhibition-demo.json', 'Выставочная демонстрация');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo(
    () => ({
      start,
      pause,
      step,
      reset,
      restartParticles,
      setSpeed,
      loadPresetById,
      importPreset,
      exportPreset,
      setParam,
      resetParams,
      setLayer,
      setTool,
      setBrushSize,
      applyToolAt,
      selectFood,
      toggleFood,
      removeFood,
      compareAStar,
      extractPhysarum,
      addObstacle,
      clearWalls,
      clearTrail,
      clearAll,
      exportMetricsJson,
      exportCsv,
    }),
    [
      start,
      pause,
      step,
      reset,
      restartParticles,
      setSpeed,
      loadPresetById,
      importPreset,
      exportPreset,
      setParam,
      resetParams,
      setLayer,
      setTool,
      setBrushSize,
      applyToolAt,
      selectFood,
      toggleFood,
      removeFood,
      compareAStar,
      extractPhysarum,
      addObstacle,
      clearWalls,
      clearTrail,
      clearAll,
      exportMetricsJson,
      exportCsv,
    ],
  );

  return { ui, actions, attachCanvas, engine };
}

export type SimulationActions = ReturnType<typeof useSimulation>['actions'];
export type AttachCanvas = ReturnType<typeof useSimulation>['attachCanvas'];

/** Восстанавливает список клеток-стен как 1x1 прямоугольники для экспорта. */
function extractWalls(engine: SimulationEngine) {
  const walls: Array<{ x: number; y: number; width: number; height: number }> =
    [];
  const w = engine.world;
  for (let y = 0; y < w.height; y++) {
    for (let x = 0; x < w.width; x++) {
      if (w.isWall(x, y)) {
        walls.push({ x, y, width: 1, height: 1 });
      }
    }
  }
  return walls;
}
