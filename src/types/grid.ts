/**
 * Типы, относящиеся к двумерной среде симуляции (карта/сетка).
 */

/** Тип клетки карты. */
export type CellType = 'empty' | 'wall' | 'start' | 'food';

/**
 * Числовые коды типов клеток для компактного хранения в Uint8Array.
 * Использование чисел вместо строк критично для производительности (NFR-004).
 */
export const CELL_CODE: Record<CellType, number> = {
  empty: 0,
  wall: 1,
  start: 2,
  food: 3,
};

export const CELL_TYPE_BY_CODE: CellType[] = ['empty', 'wall', 'start', 'food'];

/** Источник питания на карте. */
export interface FoodSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  strength: number;
  label: string;
  enabled: boolean;
}

/** Стартовая область организма (круг). */
export interface StartArea {
  x: number;
  y: number;
  radius: number;
}

/** Прямоугольная стена (используется в preset-файлах). */
export interface WallRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Точка на сетке. */
export interface GridPoint {
  x: number;
  y: number;
}
