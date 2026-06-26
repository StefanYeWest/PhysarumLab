export const TRAIL_MIN_EPSILON = 0.001;

export const EXPLORED_TRAIL_EPSILON = 0.5;

export const METRICS_RECALC_INTERVAL = 15;

export const SIMULATION_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

export const TICKS_PER_FRAME_BY_SPEED: Record<number, number> = {
  0.25: 0.25,
  0.5: 0.5,
  1: 1,
  2: 2,
  4: 4,
};

export const PARTICLE_COUNT_WARNING_THRESHOLD = 8000;

export const PRESET_ENTRIES = [
  { id: 'empty', title: 'Пустое поле', file: 'empty.json' },
  { id: 'simple-maze', title: 'Простой лабиринт', file: 'simple-maze.json' },
  { id: 'double-food', title: 'Два источника питания', file: 'double-food.json' },
  {
    id: 'dynamic-obstacle-demo',
    title: 'Динамическое препятствие',
    file: 'dynamic-obstacle-demo.json',
  },
  { id: 'complex-maze', title: 'Сложный лабиринт', file: 'complex-maze.json' },
  { id: 'tokyo', title: 'Карта Токио', file: 'tokyo.json' },
  {
    id: 'exhibition-demo',
    title: 'Выставочная демонстрация',
    file: 'exhibition-demo.json',
  },
] as const;

export const PRESETS_BASE_PATH = `${import.meta.env.BASE_URL}presets/`;
