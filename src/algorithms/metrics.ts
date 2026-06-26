import type { GridPoint } from '../types/grid';
import { euclidean } from './gridMath';

export function calculatePathLength(nodes: GridPoint[]): number {
  if (nodes.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < nodes.length; i++) {
    length += euclidean(nodes[i - 1], nodes[i]);
  }
  return length;
}

export function calculateDeviation(
  aStarLength: number,
  physarumLength: number,
): number {
  if (aStarLength <= 0) return 0;
  return ((physarumLength - aStarLength) / aStarLength) * 100;
}

export function calculateEfficiency(
  aStarLength: number,
  physarumLength: number,
): number {
  if (physarumLength <= 0) return 0;
  return aStarLength / physarumLength;
}

export function calculateExploredPercent(
  exploredCells: number,
  walkableCells: number,
): number {
  if (walkableCells <= 0) return 0;
  return (exploredCells / walkableCells) * 100;
}
