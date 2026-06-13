/**
 * Типы preset-сценариев (раздел 5 ТЗ).
 */
import type { SimulationConfig } from './simulation';
import type { FoodSource, StartArea, WallRect } from './grid';

/** Структура preset-файла сценария. */
export interface Preset {
  name: string;
  description: string;
  config: SimulationConfig;
  startArea: StartArea;
  foodSources: FoodSource[];
  walls: WallRect[];
}

/** Описание preset для меню выбора сценария. */
export interface PresetEntry {
  id: string;
  title: string;
  file: string;
}
