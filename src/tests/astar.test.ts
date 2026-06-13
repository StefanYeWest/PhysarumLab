import { describe, expect, it } from 'vitest';
import { aStar } from '../algorithms/astar';

/** Хелпер: создаёт предикат проходимости из текстовой карты. */
function makeWalkable(grid: string[]): {
  width: number;
  height: number;
  isWalkable: (x: number, y: number) => boolean;
} {
  const height = grid.length;
  const width = grid[0].length;
  return {
    width,
    height,
    isWalkable: (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return grid[y][x] !== '#';
    },
  };
}

describe('A* — поиск кратчайшего пути', () => {
  it('находит путь на пустой карте (4-соседство)', () => {
    const { width, height, isWalkable } = makeWalkable([
      '......',
      '......',
      '......',
    ]);
    const r = aStar({
      width,
      height,
      isWalkable,
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      neighborhood: 4,
    });
    expect(r.found).toBe(true);
    expect(r.nodes[0]).toEqual({ x: 0, y: 0 });
    expect(r.nodes[r.nodes.length - 1]).toEqual({ x: 5, y: 0 });
    // 5 ортогональных шагов.
    expect(r.length).toBeCloseTo(5, 5);
  });

  it('использует диагонали при 8-соседстве (стоимость sqrt(2))', () => {
    const { width, height, isWalkable } = makeWalkable([
      '....',
      '....',
      '....',
      '....',
    ]);
    const r = aStar({
      width,
      height,
      isWalkable,
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 3 },
      neighborhood: 8,
    });
    expect(r.found).toBe(true);
    // 3 диагональных шага = 3 * sqrt(2).
    expect(r.length).toBeCloseTo(3 * Math.SQRT2, 5);
  });

  it('обходит препятствия', () => {
    const { width, height, isWalkable } = makeWalkable([
      '......',
      '.####.',
      '......',
    ]);
    const r = aStar({
      width,
      height,
      isWalkable,
      start: { x: 0, y: 1 },
      goal: { x: 5, y: 1 },
      neighborhood: 4,
    });
    expect(r.found).toBe(true);
    // Путь не должен проходить через стены.
    for (const n of r.nodes) {
      expect(isWalkable(n.x, n.y)).toBe(true);
    }
  });

  it('возвращает found=false при невозможном маршруте', () => {
    const { width, height, isWalkable } = makeWalkable([
      '...#...',
      '...#...',
      '...#...',
    ]);
    const r = aStar({
      width,
      height,
      isWalkable,
      start: { x: 0, y: 1 },
      goal: { x: 6, y: 1 },
      neighborhood: 8,
    });
    expect(r.found).toBe(false);
    expect(r.nodes).toHaveLength(0);
  });

  it('возвращает found=false, если старт или цель в стене', () => {
    const { width, height, isWalkable } = makeWalkable(['..', '##']);
    const r = aStar({
      width,
      height,
      isWalkable,
      start: { x: 0, y: 1 },
      goal: { x: 1, y: 0 },
      neighborhood: 4,
    });
    expect(r.found).toBe(false);
  });
});
