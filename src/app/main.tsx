import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './global.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Корневой элемент #root не найден.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
