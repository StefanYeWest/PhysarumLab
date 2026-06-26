export const PALETTE = {
  background: '#0a0e1a',
  grid: 'rgba(120, 140, 180, 0.08)',
  wall: '#3a4252',
  wallEdge: '#525c70',
  start: '#38bdf8',
  startFill: 'rgba(56, 189, 248, 0.18)',
  food: '#a3e635',
  foodDisabled: '#5a6b3a',
  particle: 'rgba(226, 232, 240, 0.9)',
  aStar: '#f472b6',
  physarum: '#fb923c',
  activeNetwork: 'rgba(251, 191, 36, 0.35)',
  label: '#e2e8f0',
} as const;

export const TRAIL_COLOR_TABLE = buildTrailColorTable();

function buildTrailColorTable(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 3);
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [10, 8, 40]],
    [0.25, [60, 20, 110]],
    [0.5, [190, 50, 130]],
    [0.75, [250, 130, 50]],
    [1.0, [255, 240, 130]],
  ];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b] = sampleGradient(stops, t);
    table[i * 3] = r;
    table[i * 3 + 1] = g;
    table[i * 3 + 2] = b;
  }
  return table;
}

function sampleGradient(
  stops: Array<[number, [number, number, number]]>,
  t: number,
): [number, number, number] {
  for (let i = 1; i < stops.length; i++) {
    const [pos1, col1] = stops[i];
    if (t <= pos1) {
      const [pos0, col0] = stops[i - 1];
      const f = (t - pos0) / (pos1 - pos0 || 1);
      return [
        col0[0] + (col1[0] - col0[0]) * f,
        col0[1] + (col1[1] - col0[1]) * f,
        col0[2] + (col1[2] - col0[2]) * f,
      ];
    }
  }
  return stops[stops.length - 1][1];
}
