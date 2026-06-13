/**
 * Сериализация/валидация preset-сценариев и формирование CSV.
 */
import type { Preset } from '../types/presets';
import type { MetricsHistoryRow } from '../types/metrics';
import { DEFAULT_CONFIG } from '../config/defaultConfig';

/** Заголовок CSV истории метрик (FR-112). */
export const METRICS_CSV_HEADER =
  'tick,fps,activeTrailCells,exploredPercent,connectedFoodCount,aStarPathLength,physarumPathLength,routeDeviationPercent,routeEfficiency';

/** Преобразует историю метрик в CSV-строку. */
export function metricsHistoryToCsv(rows: MetricsHistoryRow[]): string {
  const lines = [METRICS_CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        r.tick,
        r.fps.toFixed(1),
        r.activeTrailCells,
        r.exploredPercent.toFixed(2),
        r.connectedFoodCount,
        formatNullable(r.aStarPathLength),
        formatNullable(r.physarumPathLength),
        formatNullable(r.routeDeviationPercent),
        formatNullable(r.routeEfficiency),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function formatNullable(value: number | null): string {
  return value === null ? '' : value.toFixed(2);
}

/**
 * Проверяет и нормализует загруженный preset.
 * Бросает ошибку с понятным сообщением при некорректной структуре (NFR-010/011).
 */
export function parsePreset(raw: unknown): Preset {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Файл сценария пуст или имеет неверный формат.');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string') {
    throw new Error('В сценарии отсутствует поле "name".');
  }
  if (typeof obj.config !== 'object' || obj.config === null) {
    throw new Error('В сценарии отсутствует секция "config".');
  }
  if (typeof obj.startArea !== 'object' || obj.startArea === null) {
    throw new Error('В сценарии отсутствует "startArea".');
  }
  if (!Array.isArray(obj.foodSources)) {
    throw new Error('Поле "foodSources" должно быть массивом.');
  }
  if (!Array.isArray(obj.walls)) {
    throw new Error('Поле "walls" должно быть массивом.');
  }

  // Конфиг дополняется значениями по умолчанию, чтобы устойчиво
  // принимать частично заполненные сценарии.
  const config = { ...DEFAULT_CONFIG, ...(obj.config as object) };

  return {
    name: obj.name,
    description: typeof obj.description === 'string' ? obj.description : '',
    config,
    startArea: obj.startArea as Preset['startArea'],
    foodSources: obj.foodSources as Preset['foodSources'],
    walls: obj.walls as Preset['walls'],
  };
}
