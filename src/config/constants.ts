/**
 * Глобальные константы приложения.
 * Магические числа выносятся сюда (NFR-052).
 */

/** Ниже этого значения след принудительно обнуляется (оптимизация). */
export const TRAIL_MIN_EPSILON = 0.001;

/** Клетка считается «исследованной», если в ней есть хоть какой-то след. */
export const EXPLORED_TRAIL_EPSILON = 0.5;

/** Как часто пересчитываются тяжёлые метрики (в тиках) (FR-072, FR-073). */
export const METRICS_RECALC_INTERVAL = 15;

/** Доступные множители скорости симуляции (FR-024). */
export const SIMULATION_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

/**
 * Соответствие множителя скорости числу тиков модели на один кадр.
 * Для значений < 1 кадр пропускается (тик выполняется реже).
 */
export const TICKS_PER_FRAME_BY_SPEED: Record<number, number> = {
  0.25: 0.25,
  0.5: 0.5,
  1: 1,
  2: 2,
  4: 4,
};

/** Порог количества частиц, после которого UI предупреждает о просадке FPS (NFR-013). */
export const PARTICLE_COUNT_WARNING_THRESHOLD = 4000;

/** Список доступных preset-сценариев (FR-040). */
export const PRESET_ENTRIES = [
  { id: 'empty', title: 'Пустое поле', file: 'empty.json' },
  { id: 'simple-maze', title: 'Простой лабиринт', file: 'simple-maze.json' },
  { id: 'double-food', title: 'Два источника питания', file: 'double-food.json' },
  {
    id: 'dynamic-obstacle-demo',
    title: 'Динамическое препятствие',
    file: 'dynamic-obstacle-demo.json',
  },
  {
    id: 'exhibition-demo',
    title: 'Выставочная демонстрация',
    file: 'exhibition-demo.json',
  },
] as const;

/** Базовый путь к preset-файлам (учитывает base из vite.config). */
export const PRESETS_BASE_PATH = `${import.meta.env.BASE_URL}presets/`;
