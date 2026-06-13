/**
 * Вспомогательные функции для работы с координатами сетки.
 */
import type { GridPoint } from '../types/grid';
import type { Neighborhood } from '../types/simulation';

/** Линейный индекс клетки в одномерном массиве. */
export function cellIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

/** Проверка, что координаты находятся внутри сетки. */
export function inBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Евклидово расстояние между двумя точками. */
export function euclidean(a: GridPoint, b: GridPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Манхэттенское расстояние между двумя точками. */
export function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Смещения соседей в зависимости от режима соседства. */
export interface NeighborOffset {
  dx: number;
  dy: number;
  cost: number;
}

const ORTHO: NeighborOffset[] = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
];

const SQRT2 = Math.SQRT2;

const DIAGONAL: NeighborOffset[] = [
  { dx: 1, dy: 1, cost: SQRT2 },
  { dx: 1, dy: -1, cost: SQRT2 },
  { dx: -1, dy: 1, cost: SQRT2 },
  { dx: -1, dy: -1, cost: SQRT2 },
];

/** Возвращает смещения соседей для заданного режима (4 или 8). */
export function getNeighborOffsets(
  neighborhood: Neighborhood,
): NeighborOffset[] {
  return neighborhood === 8 ? [...ORTHO, ...DIAGONAL] : ORTHO;
}
