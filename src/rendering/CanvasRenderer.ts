/**
 * CanvasRenderer — отрисовка состояния симуляции на HTML Canvas 2D.
 *
 * Использует ImageData для тепловой карты следа (быстро, без тысяч
 * DOM-элементов, NFR-005). Поддерживает включение/выключение слоёв (FR-061).
 */
import type { SimulationEngine } from '../model/SimulationEngine';
import { CELL_CODE } from '../types/grid';
import { PALETTE, TRAIL_COLOR_TABLE } from './colorMaps';
import { drawDisc, drawLabel, drawPolyline } from './drawUtils';

/** Видимость визуальных слоёв (FR-061). */
export interface LayerVisibility {
  particles: boolean;
  trail: boolean;
  heatmap: boolean;
  aStar: boolean;
  physarum: boolean;
  activeNetwork: boolean;
  grid: boolean;
  labels: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  particles: true,
  trail: true,
  heatmap: true,
  aStar: true,
  physarum: true,
  activeNetwork: false,
  grid: false,
  labels: true,
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private cellImageWidth = 0;
  private cellImageHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Не удалось получить 2D-контекст Canvas.');
    this.ctx = ctx;
  }

  /** Подгоняет размеры канваса под сетку и cellSize. */
  resize(width: number, height: number, cellSize: number): void {
    this.canvas.width = width * cellSize;
    this.canvas.height = height * cellSize;
    if (this.cellImageWidth !== width || this.cellImageHeight !== height) {
      this.imageData = this.ctx.createImageData(width, height);
      this.cellImageWidth = width;
      this.cellImageHeight = height;
    }
  }

  /** Полная отрисовка кадра. */
  render(engine: SimulationEngine, layers: LayerVisibility): void {
    const { world, config } = engine;
    const cs = config.cellSize;
    const ctx = this.ctx;

    // Фон.
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Тепловая карта следа через ImageData (масштабируется на клетку).
    if (layers.trail) {
      this.renderTrailLayer(engine, layers.heatmap);
    }

    // Сетка.
    if (layers.grid) {
      this.renderGrid(world.width, world.height, cs);
    }

    // Стены и метки-клетки.
    this.renderCells(engine);

    // Активная сеть.
    if (layers.activeNetwork) {
      this.renderActiveNetwork(engine);
    }

    // Стартовая область.
    const sa = world.startArea;
    drawDisc(ctx, sa.x, sa.y, sa.radius, cs, PALETTE.startFill, PALETTE.start, 2);

    // Источники питания.
    for (const f of world.foodSources) {
      const color = f.enabled ? PALETTE.food : PALETTE.foodDisabled;
      drawDisc(
        ctx,
        f.x,
        f.y,
        f.radius,
        cs,
        f.enabled ? 'rgba(163, 230, 53, 0.25)' : 'rgba(90, 107, 58, 0.2)',
        color,
        2,
      );
    }

    // Частицы.
    if (layers.particles) {
      this.renderParticles(engine);
    }

    // Маршруты.
    if (layers.aStar && engine.aStarResult?.found) {
      drawPolyline(ctx, engine.aStarResult.nodes, cs, PALETTE.aStar, 2.5, true);
    }
    if (layers.physarum && engine.physarumResult?.found) {
      drawPolyline(
        ctx,
        engine.physarumResult.nodes,
        cs,
        PALETTE.physarum,
        3.5,
        false,
      );
    }

    // Подписи.
    if (layers.labels) {
      drawLabel(ctx, 'Старт', sa.x, sa.y - sa.radius - 2, cs, PALETTE.start);
      for (const f of world.foodSources) {
        drawLabel(ctx, f.label, f.x, f.y - f.radius - 2, cs, PALETTE.food);
      }
    }
  }

  private renderTrailLayer(engine: SimulationEngine, heatmap: boolean): void {
    const { world, config } = engine;
    if (!this.imageData) return;
    const data = this.imageData.data;
    const trail = world.trail;

    // Авто-масштаб яркости: нормируем по текущему максимуму следа, а не по
    // абсолютному пределу. Так тепловая карта остаётся яркой при любых
    // параметрах испарения/депозита. Нижний порог не даёт «вспыхивать» шуму.
    let peak = 0;
    for (let i = 0; i < trail.length; i++) {
      if (trail[i] > peak) peak = trail[i];
    }
    const maxValue = Math.max(peak, 24);

    for (let i = 0; i < trail.length; i++) {
      const v = trail[i];
      const o = i * 4;
      if (v <= 0) {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
        continue;
      }
      const norm = Math.min(1, v / maxValue);
      if (heatmap) {
        const idx = Math.min(255, Math.floor(norm * 255)) * 3;
        data[o] = TRAIL_COLOR_TABLE[idx];
        data[o + 1] = TRAIL_COLOR_TABLE[idx + 1];
        data[o + 2] = TRAIL_COLOR_TABLE[idx + 2];
      } else {
        const g = Math.floor(norm * 220);
        data[o] = g;
        data[o + 1] = g;
        data[o + 2] = Math.floor(g * 0.7);
      }
      data[o + 3] = Math.floor(Math.min(1, norm * 1.6) * 255);
    }

    // Рисуем ImageData в маленький offscreen и масштабируем.
    const cs = config.cellSize;
    const off = document.createElement('canvas');
    off.width = world.width;
    off.height = world.height;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(this.imageData, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(off, 0, 0, world.width * cs, world.height * cs);
  }

  private renderCells(engine: SimulationEngine): void {
    const { world, config } = engine;
    const cs = config.cellSize;
    const ctx = this.ctx;
    const cells = world.cellTypes;
    ctx.fillStyle = PALETTE.wall;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (cells[y * world.width + x] === CELL_CODE.wall) {
          ctx.fillRect(x * cs, y * cs, cs, cs);
        }
      }
    }
  }

  private renderActiveNetwork(engine: SimulationEngine): void {
    const { world, config } = engine;
    const cs = config.cellSize;
    const ctx = this.ctx;
    const threshold = config.trailThresholdForPath;
    const trail = world.trail;
    const cells = world.cellTypes;
    ctx.fillStyle = PALETTE.activeNetwork;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const i = y * world.width + x;
        if (cells[i] === CELL_CODE.wall) continue;
        if (trail[i] >= threshold) {
          ctx.fillRect(x * cs, y * cs, cs, cs);
        }
      }
    }
  }

  private renderParticles(engine: SimulationEngine): void {
    const { particles, config } = engine;
    const cs = config.cellSize;
    const ctx = this.ctx;
    const size = Math.max(1, cs * 0.5);
    ctx.fillStyle = PALETTE.particle;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const px = (p.x + 0.5) * cs;
      const py = (p.y + 0.5) * cs;
      ctx.rect(px - size / 2, py - size / 2, size, size);
    }
    ctx.fill();
  }

  private renderGrid(width: number, height: number, cs: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, height * cs);
    }
    for (let y = 0; y <= height; y++) {
      ctx.moveTo(0, y * cs);
      ctx.lineTo(width * cs, y * cs);
    }
    ctx.stroke();
    ctx.restore();
  }
}
