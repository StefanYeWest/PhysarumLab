/**
 * PresetPanel — выбор сценариев, импорт/экспорт JSON и управление
 * источниками питания (FR-040..043, FR-034..036, FR-082).
 */
import { useRef, useState } from 'react';
import styles from './PresetPanel.module.css';
import type { SimulationActions, UiState } from '../../app/useSimulation';
import { PRESET_ENTRIES } from '../../config/constants';

interface Props {
  ui: UiState;
  actions: SimulationActions;
}

const DEFAULT_PRESET_ID =
  PRESET_ENTRIES.find((p) => p.id === 'exhibition-demo')?.id ??
  PRESET_ENTRIES[0].id;

export function PresetPanel({ ui, actions }: Props) {
  const [selected, setSelected] = useState<string>(DEFAULT_PRESET_ID);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleLoad = () => {
    const entry = PRESET_ENTRIES.find((p) => p.id === selected);
    if (entry) void actions.loadPresetById(entry.file, entry.title);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void actions.importPreset(file);
    e.target.value = '';
  };

  return (
    <div className="panel">
      <div className="panel-title">Сценарии</div>

      <div className={styles.presetRow}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {PRESET_ENTRIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={handleLoad}>
          Загрузить
        </button>
      </div>

      <div className={styles.currentPreset}>Текущий: {ui.presetName}</div>

      <div className="btn-row">
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Импорт JSON
        </button>
        <button className="btn" onClick={actions.exportPreset}>
          Экспорт JSON
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImport}
        hidden
      />

      <div className={styles.foodTitle}>Источники питания</div>
      {ui.foodSources.length === 0 && (
        <div className={styles.empty}>
          Источников нет. Выберите инструмент «Еда» и кликните по карте.
        </div>
      )}
      <div className={styles.foodList}>
        {ui.foodSources.map((f) => (
          <div
            key={f.id}
            className={`${styles.foodItem} ${
              ui.selectedFoodId === f.id ? styles.foodSelected : ''
            }`}
          >
            <button
              className={styles.foodLabel}
              onClick={() => actions.selectFood(f.id)}
              title="Выбрать для сравнения с A*"
            >
              {ui.selectedFoodId === f.id ? '◉' : '○'} {f.label}
            </button>
            <label className={styles.foodToggle}>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => actions.toggleFood(f.id, e.target.checked)}
              />
              вкл
            </label>
            <button
              className={styles.foodRemove}
              onClick={() => actions.removeFood(f.id)}
              title="Удалить источник"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
