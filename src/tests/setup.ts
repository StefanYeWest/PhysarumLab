import '@testing-library/jest-dom';

// performance.now присутствует в jsdom, но на всякий случай гарантируем наличие.
if (typeof performance === 'undefined') {
  // @ts-expect-error — полифилл для тестовой среды.
  globalThis.performance = { now: () => Date.now() };
}
