import styles from './ExperimentPanel.module.css';
import type { SimulationActions, UiState } from '../../app/useSimulation';

interface Props {
  ui: UiState;
  actions: SimulationActions;
}

export function ExperimentPanel({ ui, actions }: Props) {
  const selectedFood = ui.foodSources.find((f) => f.id === ui.selectedFoodId);

  return (
    <div className="panel">
      <div className="panel-title">Эксперименты и анализ</div>

      {ui.foodSources.length > 1 && (
        <div className={styles.targetNote}>
          Цель сравнения: <b>{selectedFood?.label ?? '—'}</b>
        </div>
      )}

      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={actions.compareAStar}>
          Сравнить с A*
        </button>
        <button className="btn btn-accent" onClick={actions.extractPhysarum}>
          Извлечь маршрут Physarum
        </button>
        <button className="btn" onClick={actions.addObstacle}>
          Добавить препятствие на маршрут
        </button>
      </div>

      <div className={styles.exportTitle}>Экспорт данных</div>
      <div className="btn-row">
        <button className="btn" onClick={actions.exportMetricsJson}>
          Метрики → JSON
        </button>
        <button className="btn" onClick={actions.exportCsv}>
          История → CSV
        </button>
      </div>
    </div>
  );
}
