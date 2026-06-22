/**
 * Конфигурация симуляции по умолчанию и метаданные параметров для UI.
 */
import type { SimulationConfig } from '../types/simulation';

/** Значения симуляции по умолчанию (совпадают с выставочным сценарием). */
export const DEFAULT_CONFIG: SimulationConfig = {
  gridWidth: 180,
  gridHeight: 120,
  cellSize: 5,

  particleCount: 2800,
  particleSpeed: 1.2,
  sensorDistance: 9,
  sensorAngleDegrees: 45,
  turnAngleDegrees: 22.5,

  trailDepositAmount: 5,
  trailEvaporationRate: 0.04,
  trailDiffusionRate: 0.18,
  trailMaxValue: 255,

  foodAttractionStrength: 180,
  foodAttractionRadius: 24,

  simulationSpeed: 1,
  randomSeed: 42,

  trailThresholdForPath: 18,
  stuckParticleRespawnTicks: 80,
};

/** Какие параметры можно менять «на лету» без полного сброса (FR-052). */
export type ConfigParamKey = keyof SimulationConfig;

/** Описание настраиваемого параметра для панели параметров (FR-050, 19.4). */
export interface ParamMeta {
  key: ConfigParamKey;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  /** true — изменение применяется без сброса симуляции (FR-051/052). */
  liveEditable: boolean;
  tooltip: string;
}

/** Метаданные всех редактируемых параметров. */
export const PARAM_META: ParamMeta[] = [
  {
    key: 'particleCount',
    label: 'Количество частиц',
    unit: 'шт',
    min: 100,
    max: 30000,
    step: 100,
    liveEditable: false,
    tooltip:
      'Число агентов на карте. Больше частиц — быстрее и устойчивее формируется сеть, но ниже FPS. Изменение требует пересоздания частиц.',
  },
  {
    key: 'particleSpeed',
    label: 'Скорость частиц',
    unit: 'кл/тик',
    min: 0.2,
    max: 3,
    step: 0.1,
    liveEditable: true,
    tooltip:
      'Насколько далеко частица смещается за один тик. Высокая скорость ускоряет исследование, но может «перепрыгивать» тонкие проходы.',
  },
  {
    key: 'sensorDistance',
    label: 'Дистанция сенсоров',
    unit: 'кл',
    min: 2,
    max: 15,
    step: 1,
    liveEditable: true,
    tooltip:
      'Как далеко вперёд частица «чувствует» сигнал. Рекомендуется 5–10 клеток. Слишком большое значение делает движение менее чувствительным к деталям.',
  },
  {
    key: 'sensorAngleDegrees',
    label: 'Угол сенсоров',
    unit: '°',
    min: 5,
    max: 90,
    step: 1,
    liveEditable: true,
    tooltip:
      'Угол между центральным сенсором и боковыми. Больший угол — шире обзор, более ветвистая сеть.',
  },
  {
    key: 'turnAngleDegrees',
    label: 'Угол поворота',
    unit: '°',
    min: 1,
    max: 90,
    step: 0.5,
    liveEditable: true,
    tooltip:
      'На сколько градусов частица доворачивает к более сильному сигналу за тик. Малый угол — плавные маршруты, большой — резкие.',
  },
  {
    key: 'trailDepositAmount',
    label: 'Количество следа',
    min: 1,
    max: 50,
    step: 1,
    liveEditable: true,
    tooltip:
      'Сколько следа частица оставляет в клетке за тик. Больше — быстрее закрепляются маршруты, но выше шум.',
  },
  {
    key: 'trailEvaporationRate',
    label: 'Скорость испарения следа',
    min: 0,
    max: 0.2,
    step: 0.001,
    liveEditable: true,
    tooltip:
      'Насколько быстро исчезают слабые маршруты. Слишком большое значение — сеть не успевает закрепиться. Слишком маленькое — карта зашумляется.',
  },
  {
    key: 'trailDiffusionRate',
    label: 'Скорость диффузии следа',
    min: 0,
    max: 1,
    step: 0.01,
    liveEditable: true,
    tooltip:
      'Насколько след «растекается» на соседние клетки. Делает сигнал плавнее, помогает частицам находить дорожки.',
  },
  {
    key: 'foodAttractionStrength',
    label: 'Сила притяжения еды',
    min: 0,
    max: 300,
    step: 5,
    liveEditable: true,
    tooltip:
      'Насколько сильно источник питания тянет частицы. Рекомендуется 100–250. Слишком большое значение заменяет самоорганизацию прямым движением к цели.',
  },
  {
    key: 'foodAttractionRadius',
    label: 'Радиус притяжения еды',
    unit: 'кл',
    min: 5,
    max: 50,
    step: 1,
    liveEditable: true,
    tooltip:
      'Радиус локального влияния источника питания. Рекомендуется 15–30 клеток. Притяжение должно оставаться локальным.',
  },
  {
    key: 'trailThresholdForPath',
    label: 'Порог следа для маршрута',
    min: 1,
    max: 200,
    step: 1,
    liveEditable: true,
    tooltip:
      'Минимальное значение следа, при котором клетка считается частью активной сети для извлечения маршрута Physarum.',
  },
  {
    key: 'randomSeed',
    label: 'Seed случайности',
    min: 0,
    max: 999999,
    step: 1,
    liveEditable: false,
    tooltip:
      'Зерно генератора случайных чисел. Одинаковый seed обеспечивает воспроизводимость эксперимента. Изменение требует сброса.',
  },
];
