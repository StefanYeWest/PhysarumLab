export type CellType = 'empty' | 'wall' | 'start' | 'food';

export const CELL_CODE: Record<CellType, number> = {
  empty: 0,
  wall: 1,
  start: 2,
  food: 3,
};

export const CELL_TYPE_BY_CODE: CellType[] = ['empty', 'wall', 'start', 'food'];

export interface FoodSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  strength: number;
  label: string;
  enabled: boolean;
}

export interface StartArea {
  x: number;
  y: number;
  radius: number;
}

export interface WallRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridPoint {
  x: number;
  y: number;
}
