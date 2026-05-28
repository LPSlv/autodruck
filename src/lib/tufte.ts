// Tufte-style sparkline path helpers. No DOM, no IO.
export type SparkPoint = number;

export function sparklinePath(
  values: SparkPoint[],
  opts: { width: number; height: number; pad?: number }
): { d: string; min: number; max: number } {
  const { width, height, pad = 1 } = opts;
  const n = values.length;
  if (n === 0) return { d: '', min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  if (n === 1) {
    const x = (pad + w / 2).toFixed(1);
    const y = (pad + h / 2).toFixed(1);
    return { d: `M${x} ${y}`, min, max };
  }
  const pts = values.map((v, i) => {
    const x = pad + (i / (n - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as [number, number];
  });
  const d = pts.map(([x, y], i) =>
    i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`
  ).join(' ');
  return { d, min, max };
}

// Legacy wrapper for compatibility — returns raw SVG string
export function sparkline(values: SparkPoint[], opts: {
  width?: number; height?: number; stroke?: string; fill?: string;
  showLast?: boolean; padding?: number;
} = {}): string {
  const { width = 110, height = 14, stroke = 'currentColor', fill = 'none', showLast = true, padding = 1 } = opts;
  if (!values || !values.length) return '';
  const n = values.length;
  if (n === 1) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><circle cx="${width/2}" cy="${height/2}" r="1.5" fill="${stroke}"/></svg>`;
  }
  const { d } = sparklinePath(values, { width, height, pad: padding });
  const pts = values.map((v, i) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = width - padding * 2;
    const h = height - padding * 2;
    return [padding + (i / (n - 1)) * w, padding + h - ((v - min) / span) * h] as [number, number];
  });
  const last = pts[pts.length - 1];
  const lastDot = showLast
    ? `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="1.6" fill="${stroke}"/>`
    : '';
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:${width}px;height:${height}px"><path d="${d}" stroke="${stroke}" fill="${fill}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>${lastDot}</svg>`;
}
