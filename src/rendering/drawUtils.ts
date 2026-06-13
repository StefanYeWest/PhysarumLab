/**
 * Низкоуровневые помощники отрисовки на Canvas 2D.
 */
import type { GridPoint } from '../types/grid';

/** Рисует ломаную линию по точкам сетки с учётом размера клетки. */
export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  nodes: GridPoint[],
  cellSize: number,
  color: string,
  lineWidth: number,
  dashed = false,
): void {
  if (nodes.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([cellSize * 1.6, cellSize * 1.2]);
  ctx.beginPath();
  ctx.moveTo(
    (nodes[0].x + 0.5) * cellSize,
    (nodes[0].y + 0.5) * cellSize,
  );
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo((nodes[i].x + 0.5) * cellSize, (nodes[i].y + 0.5) * cellSize);
  }
  ctx.stroke();
  ctx.restore();
}

/** Рисует круг (диск) с обводкой в координатах сетки. */
export function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  cellSize: number,
  fill: string,
  stroke?: string,
  lineWidth = 2,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    (cx + 0.5) * cellSize,
    (cy + 0.5) * cellSize,
    radius * cellSize,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/** Рисует текстовую подпись в координатах сетки. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  cellSize: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, (cx + 0.5) * cellSize, (cy + 0.5) * cellSize);
  ctx.restore();
}
