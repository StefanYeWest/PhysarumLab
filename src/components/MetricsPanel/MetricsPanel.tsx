/**
 * MetricsPanel — панель метрик, сгруппированных по разделам (FR-070, 19.5).
 * Недоступные метрики показываются как «—» (FR-071).
 */
import styles from './MetricsPanel.module.css';
import type { SimulationMetrics } from '../../types/metrics';

interface Props {
  metrics: SimulationMetrics;
}

const dash = '—';

function num(value: number | null, digits = 1, suffix = ''): string {
  if (value === null || Number.isNaN(value)) return dash;
  return `${value.toFixed(digits)}${suffix}`;
}

function int(value: number | null, suffix = ''): string {
  if (value === null || Number.isNaN(value)) return dash;
  return `${Math.round(value)}${suffix}`;
}

export function MetricsPanel({ metrics: m }: Props) {
  const groups: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: 'Производительность',
      rows: [
        ['Тик', String(m.tick)],
        ['FPS', String(m.fps)],
        ['Частиц', String(m.particleCount)],
      ],
    },
    {
      title: 'Исследование карты',
      rows: [
        ['Активных клеток следа', String(m.activeTrailCells)],
        ['Исследовано клеток', String(m.exploredCells)],
        ['Покрытие карты', num(m.exploredPercent, 1, ' %')],
      ],
    },
    {
      title: 'Поиск маршрута',
      rows: [
        [
          'Источников питания',
          `${m.connectedFoodCount} / ${m.totalFoodCount}`,
        ],
        ['Первое обнаружение, тик', int(m.firstFoodFoundTick)],
      ],
    },
    {
      title: 'Сравнение с A*',
      rows: [
        ['Длина A*', num(m.aStarPathLength, 1)],
        ['Длина Physarum', num(m.physarumPathLength, 1)],
        ['Отклонение', num(m.routeDeviationPercent, 1, ' %')],
        ['Эффективность', num(m.routeEfficiency, 3)],
      ],
    },
    {
      title: 'Динамическая устойчивость',
      rows: [
        ['Стоимость сети', num(m.networkCost, 1)],
        [
          'Время восстановления, тик',
          int(m.recoveryTimeAfterObstacleTicks),
        ],
      ],
    },
  ];

  return (
    <div className="panel">
      <div className="panel-title">Метрики</div>
      <div className={styles.groups}>
        {groups.map((g) => (
          <div key={g.title} className={styles.group}>
            <div className={styles.groupTitle}>{g.title}</div>
            {g.rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <span className={styles.label}>{label}</span>
                <span className={styles.value}>{value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
