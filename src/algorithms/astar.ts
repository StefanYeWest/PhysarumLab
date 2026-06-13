/**
 * Самостоятельная реализация алгоритма A* на сетке (раздел 11/15 ТЗ).
 * Готовые pathfinding-библиотеки не используются.
 */
import type { GridPoint } from '../types/grid';
import type { Neighborhood } from '../types/simulation';
import type { PathResult } from '../types/metrics';
import {
  cellIndex,
  euclidean,
  getNeighborOffsets,
  inBounds,
  manhattan,
} from './gridMath';

/**
 * Бинарная min-куча по f-стоимости.
 * Хранит индексы клеток; стоимости берутся из внешнего массива fScore.
 */
class MinHeap {
  private heap: number[] = [];

  constructor(private readonly fScore: Float64Array) {}

  get size(): number {
    return this.heap.length;
  }

  push(node: number): void {
    const heap = this.heap;
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.fScore[heap[parent]] <= this.fScore[heap[i]]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  pop(): number {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftDown(start: number): void {
    const heap = this.heap;
    const n = heap.length;
    let i = start;
    for (;;) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < n && this.fScore[heap[left]] < this.fScore[heap[smallest]]) {
        smallest = left;
      }
      if (right < n && this.fScore[heap[right]] < this.fScore[heap[smallest]]) {
        smallest = right;
      }
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
}

export interface AStarOptions {
  width: number;
  height: number;
  /** Предикат проходимости клетки. */
  isWalkable: (x: number, y: number) => boolean;
  start: GridPoint;
  goal: GridPoint;
  neighborhood: Neighborhood;
}

const EMPTY_RESULT = (timeMs: number, visited: number): PathResult => ({
  found: false,
  nodes: [],
  length: 0,
  visitedNodes: visited,
  calculationTimeMs: timeMs,
});

/**
 * Запускает A* и возвращает кратчайший путь от start до goal.
 * Стоимость ортогонального шага = 1, диагонального = sqrt(2).
 */
export function aStar(options: AStarOptions): PathResult {
  const { width, height, isWalkable, start, goal, neighborhood } = options;
  const t0 = performance.now();

  const startX = Math.round(start.x);
  const startY = Math.round(start.y);
  const goalX = Math.round(goal.x);
  const goalY = Math.round(goal.y);

  if (!inBounds(startX, startY, width, height) || !isWalkable(startX, startY)) {
    return EMPTY_RESULT(performance.now() - t0, 0);
  }
  if (!inBounds(goalX, goalY, width, height) || !isWalkable(goalX, goalY)) {
    return EMPTY_RESULT(performance.now() - t0, 0);
  }

  const size = width * height;
  const gScore = new Float64Array(size).fill(Infinity);
  const fScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const inOpen = new Uint8Array(size);

  const offsets = getNeighborOffsets(neighborhood);
  const heuristic = (x: number, y: number): number =>
    neighborhood === 8
      ? euclidean({ x, y }, { x: goalX, y: goalY })
      : manhattan({ x, y }, { x: goalX, y: goalY });

  const startIdx = cellIndex(startX, startY, width);
  const goalIdx = cellIndex(goalX, goalY, width);
  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startX, startY);

  const open = new MinHeap(fScore);
  open.push(startIdx);
  inOpen[startIdx] = 1;

  let visitedNodes = 0;

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    inOpen[current] = 0;
    closed[current] = 1;
    visitedNodes++;

    if (current === goalIdx) {
      return reconstructPath(
        cameFrom,
        current,
        width,
        gScore[goalIdx],
        visitedNodes,
        performance.now() - t0,
      );
    }

    const cx = current % width;
    const cy = (current / width) | 0;

    for (const off of offsets) {
      const nx = cx + off.dx;
      const ny = cy + off.dy;
      if (!inBounds(nx, ny, width, height)) continue;
      if (!isWalkable(nx, ny)) continue;

      // Запрет «срезания углов» по диагонали через стену.
      if (off.dx !== 0 && off.dy !== 0) {
        if (!isWalkable(cx + off.dx, cy) || !isWalkable(cx, cy + off.dy)) {
          continue;
        }
      }

      const nIdx = cellIndex(nx, ny, width);
      if (closed[nIdx]) continue;

      const tentativeG = gScore[current] + off.cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(nx, ny);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        } else {
          // Обновлённая стоимость: повторно кладём в кучу (ленивое удаление).
          open.push(nIdx);
        }
      }
    }
  }

  return EMPTY_RESULT(performance.now() - t0, visitedNodes);
}

function reconstructPath(
  cameFrom: Int32Array,
  goalIdx: number,
  width: number,
  length: number,
  visitedNodes: number,
  timeMs: number,
): PathResult {
  const nodes: GridPoint[] = [];
  let current = goalIdx;
  while (current !== -1) {
    nodes.push({ x: current % width, y: (current / width) | 0 });
    current = cameFrom[current];
  }
  nodes.reverse();
  return {
    found: true,
    nodes,
    length,
    visitedNodes,
    calculationTimeMs: timeMs,
  };
}
