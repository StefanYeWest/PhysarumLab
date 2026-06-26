import type { SimulationConfig } from './simulation';
import type { FoodSource, StartArea, WallRect } from './grid';

export interface Preset {
  name: string;
  description: string;
  config: SimulationConfig;
  startArea: StartArea;
  foodSources: FoodSource[];
  walls: WallRect[];
}

export interface PresetEntry {
  id: string;
  title: string;
  file: string;
}
