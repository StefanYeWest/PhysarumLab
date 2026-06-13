/**
 * CanvasViewport — область визуализации. Подключает Canvas к рендереру
 * и обрабатывает рисование инструментами мышью (FR-031).
 */
import { useCallback, useRef } from 'react';
import styles from './CanvasViewport.module.css';
import type {
  SimulationActions,
  AttachCanvas,
  UiState,
} from '../../app/useSimulation';

interface Props {
  ui: UiState;
  actions: SimulationActions;
  attachCanvas: AttachCanvas;
}

const CONTINUOUS_TOOLS = new Set(['wall', 'erase', 'destroy']);

export function CanvasViewport({ ui, actions, attachCanvas }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const setRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasElRef.current = el;
      attachCanvas(el);
    },
    [attachCanvas],
  );

  /** Переводит координаты события в координаты клетки сетки. */
  const toCell = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasElRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;
      const cs = ui.config.cellSize;
      return {
        x: Math.floor(px / cs),
        y: Math.floor(py / cs),
      };
    },
    [ui.config.cellSize],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const cell = toCell(e.clientX, e.clientY);
      if (!cell) return;
      drawingRef.current = true;
      canvasElRef.current?.setPointerCapture(e.pointerId);
      actions.applyToolAt(cell.x, cell.y);
    },
    [toCell, actions],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      if (!CONTINUOUS_TOOLS.has(ui.tool)) return;
      const cell = toCell(e.clientX, e.clientY);
      if (!cell) return;
      actions.applyToolAt(cell.x, cell.y);
    },
    [toCell, actions, ui.tool],
  );

  const stopDrawing = useCallback(() => {
    drawingRef.current = false;
  }, []);

  return (
    <div className={styles.viewport}>
      <canvas
        ref={setRef}
        className={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      {ui.inspected && (
        <div className={styles.inspector}>
          Клетка ({ui.inspected.x}, {ui.inspected.y}) · след{' '}
          {ui.inspected.trail.toFixed(1)} · пища {ui.inspected.food.toFixed(1)}
        </div>
      )}
    </div>
  );
}
