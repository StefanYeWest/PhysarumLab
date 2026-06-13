/**
 * Чистые функции расчёта метрик маршрутов и покрытия карты.
 */
import type { GridPoint } from '../types/grid';
import { euclidean } from './gridMath';

/** Длина маршрута как сумма евклидовых расстояний между точками. */
export function calculatePathLength(nodes: GridPoint[]): number {
  if (nodes.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < nodes.length; i++) {
    length += euclidean(nodes[i - 1], nodes[i]);
  }
  return length;
}

/**
 * Процент отклонения маршрута Physarum от оптимального A*.
 * routeDeviationPercent = ((physarum - aStar) / aStar) * 100
 */
export function calculateDeviation(
  aStarLength: number,
  physarumLength: number,
): number {
  if (aStarLength <= 0) return 0;
  return ((physarumLength - aStarLength) / aStarLength) * 100;
}

/**
 * Эффективность маршрута: aStar / physarum.
 * Значение, близкое к 1, означает близость к оптимуму.
 */
export function calculateEfficiency(
  aStarLength: number,
  physarumLength: number,
): number {
  if (physarumLength <= 0) return 0;
  return aStarLength / physarumLength;
}

/** Процент исследованной карты от числа проходимых клеток. */
export function calculateExploredPercent(
  exploredCells: number,
  walkableCells: number,
): number {
  if (walkableCells <= 0) return 0;
  return (exploredCells / walkableCells) * 100;
}
