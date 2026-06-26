import { useState } from 'react';
import styles from './App.module.css';
import { useSimulation } from './useSimulation';
import { CanvasViewport } from '../components/CanvasViewport/CanvasViewport';
import { ControlPanel } from '../components/ControlPanel/ControlPanel';
import { PresetPanel } from '../components/PresetPanel/PresetPanel';
import { ParameterPanel } from '../components/ParameterPanel/ParameterPanel';
import { MetricsPanel } from '../components/MetricsPanel/MetricsPanel';
import { ExperimentPanel } from '../components/ExperimentPanel/ExperimentPanel';
import { Legend } from '../components/Legend/Legend';
import { HowItWorks } from '../components/HowItWorks/HowItWorks';

export function App() {
  const { ui, actions, attachCanvas } = useSimulation();
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Physarum Lab</h1>
          <p className={styles.subtitle}>
            Биоинспирированный поиск эффективных маршрутов в среде с препятствиями
          </p>
        </div>
        <button
          className={styles.helpButton}
          onClick={() => setHowItWorksOpen(true)}
        >
          Как это работает?
        </button>
      </header>

      <div className={styles.body}>
        <main className={styles.canvasArea}>
          <CanvasViewport ui={ui} actions={actions} attachCanvas={attachCanvas} />
          <Legend />
        </main>

        <aside className={styles.sidebar}>
          <ControlPanel ui={ui} actions={actions} />
          <ExperimentPanel ui={ui} actions={actions} />
          <PresetPanel ui={ui} actions={actions} />
          <ParameterPanel ui={ui} actions={actions} />
          <MetricsPanel metrics={ui.metrics} />
        </aside>
      </div>

      {ui.message && (
        <div className={`${styles.toast} ${styles[ui.message.kind]}`}>
          {ui.message.text}
        </div>
      )}

      {howItWorksOpen && (
        <HowItWorks onClose={() => setHowItWorksOpen(false)} />
      )}
    </div>
  );
}
