import styles from './Legend.module.css';
import { PALETTE } from '../../rendering/colorMaps';

const ITEMS: Array<{ color: string; label: string; kind?: 'gradient' | 'line' }> =
  [
    { color: PALETTE.start, label: 'Стартовая область' },
    { color: PALETTE.food, label: 'Источник питания' },
    { color: PALETTE.wall, label: 'Препятствие (стена)' },
    { color: PALETTE.particle, label: 'Частицы Physarum' },
    {
      color:
        'linear-gradient(90deg, #0a0828, #3c146e, #be3282, #fa8232, #fff082)',
      label: 'След: слабый → сильный',
      kind: 'gradient',
    },
    { color: PALETTE.aStar, label: 'Маршрут A* (эталон)', kind: 'line' },
    {
      color: PALETTE.physarum,
      label: 'Маршрут Physarum (извлечённый)',
      kind: 'line',
    },
  ];

export function Legend() {
  return (
    <div className={`panel ${styles.legend}`}>
      <div className="panel-title">Легенда</div>
      <div className={styles.items}>
        {ITEMS.map((it) => (
          <div key={it.label} className={styles.item}>
            <span
              className={`${styles.swatch} ${
                it.kind === 'line' ? styles.lineSwatch : ''
              }`}
              style={
                it.kind === 'gradient'
                  ? { background: it.color }
                  : it.kind === 'line'
                    ? { background: it.color }
                    : { background: it.color }
              }
            />
            <span className={styles.label}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
