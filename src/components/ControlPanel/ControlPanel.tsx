/**
 * ControlPanel — управление симуляцией и инструментами карты
 * (FR-020..026, FR-030..032, разделы 19.2-19.3).
 */
import styles from './ControlPanel.module.css';
import type { SimulationActions, Tool, UiState } from '../../app/useSimulation';
import { SIMULATION_SPEED_OPTIONS } from '../../config/constants';

interface Props {
  ui: UiState;
  actions: SimulationActions;
}

const TOOLS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: 'view', label: 'Просмотр', hint: 'Только наблюдение' },
  { id: 'wall', label: 'Стена', hint: 'Рисовать препятствие' },
  { id: 'erase', label: 'Ластик', hint: 'Стирать стену' },
  { id: 'start', label: 'Старт', hint: 'Поставить стартовую область' },
  { id: 'food', label: 'Еда', hint: 'Добавить источник питания' },
  { id: 'destroy', label: 'Разрушить', hint: 'Стереть след' },
  { id: 'inspect', label: 'Инспекция', hint: 'Посмотреть значения клетки' },
];

export function ControlPanel({ ui, actions }: Props) {
  return (
    <div className="panel">
      <div className="panel-title">Управление</div>

      <div className={styles.controlRow}>
        {ui.running ? (
          <button className="btn btn-accent" onClick={actions.pause}>
            ⏸ Пауза
          </button>
        ) : (
          <button className="btn btn-primary" onClick={actions.start}>
            ▶ Старт
          </button>
        )}
        <button className="btn" onClick={actions.step}>
          ⏭ Шаг
        </button>
        <button
          className="btn"
          title="Вернуть частицы в старт и очистить след, сохранив текущую карту и параметры"
          onClick={actions.restartParticles}
        >
          ⟳ Перезапуск
        </button>
        <button
          className="btn"
          title="Перезагрузить сценарий: вернуть исходную карту (ручные правки будут потеряны)"
          onClick={actions.reset}
        >
          ↺ Сброс
        </button>
      </div>

      <div className={styles.speedRow}>
        <label>Скорость</label>
        <div className={styles.speedButtons}>
          {SIMULATION_SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`btn ${ui.speed === s ? 'btn-active' : ''}`}
              onClick={() => actions.setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stats}>
        <span>
          Тик: <b>{ui.tick}</b>
        </span>
        <span>
          FPS: <b>{ui.fps}</b>
        </span>
      </div>

      <div className={styles.divider} />

      <div className="panel-title">Инструменты карты</div>
      <div className={styles.tools}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.hint}
            className={`btn ${ui.tool === t.id ? 'btn-active' : ''}`}
            onClick={() => actions.setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.brushRow}>
        <label>Размер кисти: {ui.brushSize}</label>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={ui.brushSize}
          onChange={(e) => actions.setBrushSize(Number(e.target.value))}
        />
      </div>

      <div className={styles.clearRow}>
        <button className="btn" onClick={actions.clearWalls}>
          Очистить стены
        </button>
        <button className="btn" onClick={actions.clearTrail}>
          Очистить след
        </button>
        <button className="btn btn-danger" onClick={actions.clearAll}>
          Очистить всё
        </button>
      </div>
    </div>
  );
}
