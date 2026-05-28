// Tiny Tufte-style sparkline + small-multiples. SVG strings, no deps.

export function sparkline(values, {
  width = 110, height = 14, stroke = "currentColor", fill = "none",
  showLast = true, padding = 1
} = {}) {
  if (!values || !values.length) return "";
  const n = values.length;
  if (n === 1) {
    // Single value → just a dot
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${width/2}" cy="${height/2}" r="1.5" fill="${stroke}"/>
    </svg>`;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const pts = values.map((v, i) => {
    const x = padding + (i / (n - 1)) * w;
    const y = padding + h - ((v - min) / span) * h;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`)).join(" ");
  const last = pts[pts.length - 1];
  const lastDot = showLast
    ? `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="1.6" fill="${stroke}"/>`
    : "";
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:${width}px;height:${height}px">
    <path d="${d}" stroke="${stroke}" fill="${fill}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
    ${lastDot}
  </svg>`;
}

// Horizontal "small-bar" — share-of-whole indicator. Used inline next to a number.
export function shareBar(value, total, { width = 60, height = 4 } = {}) {
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:${width}px;height:${height}px">
    <rect x="0" y="${height/2 - 0.5}" width="${width}" height="1" fill="currentColor" opacity="0.15"/>
    <rect x="0" y="0" width="${(frac * width).toFixed(2)}" height="${height}" fill="currentColor" opacity="0.7"/>
  </svg>`;
}

// Dotplot — show how a series of values compare. n ≤ 30 typical.
export function dotplot(values, { width = 220, height = 16 } = {}) {
  if (!values || !values.length) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const dots = values.map((v) => {
    const x = ((v - min) / span) * (width - 6) + 3;
    return `<circle cx="${x.toFixed(1)}" cy="${height / 2}" r="2" fill="currentColor" opacity="0.7"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:${width}px;height:${height}px">
    <line x1="3" y1="${height/2}" x2="${width-3}" y2="${height/2}" stroke="currentColor" opacity="0.2"/>
    ${dots}
  </svg>`;
}
