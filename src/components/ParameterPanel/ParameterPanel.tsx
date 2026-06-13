/**
 * ParameterPanel — слайдеры параметров модели с подсказками и
 * переключатели визуальных слоёв (FR-050..053, FR-061, NFR-022/023).
 */
import styles from './ParameterPanel.module.css';
import type { SimulationActions, UiState } from '../../app/useSimulation';
import { PARAM_META } from '../../config/defaultConfig';
import type { LayerVisibility } from '../../rendering/CanvasRenderer';
import { PARTICLE_COUNT_WARNING_THRESHOLD } from '../../config/constants';

interface Props {
  ui: UiState;
  actions: SimulationActions;
}

const LAYER_LABELS: Array<{ key: keyof LayerVisibility; label: string }> = [
  { key: 'particles', label: 'Частицы' },
  { key: 'trail', label: 'След' },
  { key: 'heatmap', label: 'Тепловая карта' },
  { key: 'aStar', label: 'Маршрут A*' },
  { key: 'physarum', label: 'Маршрут Physarum' },
  { key: 'activeNetwork', label: 'Активная сеть' },
  { key: 'grid', label: 'Сетка' },
  { key: 'labels', label: 'Подписи' },
];

export function ParameterPanel({ ui, actions }: Props) {
  const showParticleWarning =
    ui.config.particleCount > PARTICLE_COUNT_WARNING_THRESHOLD;

  return (
    <div className="panel">
      <div className={styles.headerRow}>
        <div className="panel-title">Параметры модели</div>
        <button className="btn" onClick={actions.resetParams}>
          По умолчанию
        </button>
      </div>

      {showParticleWarning && (
        <div className={styles.warning}>
          ⚠ Много частиц ({ui.config.particleCount}) — возможна просадка FPS.
        </div>
      )}

      <div className={styles.params}>
        {PARAM_META.map((meta) => {
          const value = ui.config[meta.key];
          return (
            <div key={meta.key} className={styles.param}>
              <div className={styles.paramHead}>
                <span className={styles.paramLabel} title={meta.tooltip}>
                  {meta.label}
                  {!meta.liveEditable && (
                    <span className={styles.resetBadge} title="Изменение пересоздаёт частицы">
                      ⟳
                    </span>
                  )}
                </span>
                <span className={styles.paramValue}>
                  {formatValue(value)}
                  {meta.unit ? ` ${meta.unit}` : ''}
                </span>
              </div>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={value}
                onChange={(e) =>
                  actions.setParam(meta.key, Number(e.target.value))
                }
              />
            </div>
          );
        })}
      </div>

      <div className={styles.layersTitle}>Слои визуализации</div>
      <div className={styles.layers}>
        {LAYER_LABELS.map((l) => (
          <label key={l.key} className={styles.layerItem}>
            <input
              type="checkbox"
              checked={ui.layers[l.key]}
              onChange={(e) => actions.setLayer(l.key, e.target.checked)}
            />
            {l.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(value < 1 ? 3 : 1);
}
