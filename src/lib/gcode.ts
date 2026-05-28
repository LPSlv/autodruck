// Pure gcode parse + transform helpers. No DOM, no IO.
import { md5 } from './md5';

export type PrinterId = 'a1' | 'a1mini' | 'p1s' | 'p1p' | 'p2s' | 'x1c' | 'h2s' | 'h2d' | 'h2c';

export type HeaderMetrics = {
  modelTime: string | null;
  totalTime: string | null;
  totalLayers: number;
  filamentLengthMm: number;
  filamentVolumeCm3: number;
  filamentWeightG: number;
  maxZ: number;
};

export type TuningParams = {
  cooldownTarget: number;
  cooldownOvershoot: number;
  cooldownWaitAt?: number;
  cooldown?: number;
  dwell: number;
  bedTempReheat: number;
  nozzleTempIdle: number;
  zlift: number;
  repeats: number;
  pushx: number;
  returnx: number;
  pushspeed: number;
  returnspeed: number;
  parky: number;
  parkz: number;
};

export type SubstituteParams = Partial<TuningParams> & Record<string, string | number | boolean | undefined>;

export type HeaderSourceMetric = { m: HeaderMetrics; n: number };

export type DiffLine = { type: 'add' | 'ctx'; text: string };

const RE_PRINTER_HEADER = /;\s*=+\s*machine:\s*([^\s=]+(?:\s+mini)?)/i;
const RE_PRINTER_CONFIG = /;\s*printer_model\s*=\s*([^\n]+)/i;
const RE_PRINTER_MODEL_ID = /;\s*printer_model_id\s*=\s*([^\n]+)/i;
const RE_EXEC_START = /(^|\n);\s*EXECUTABLE_BLOCK_START[ \t]*\n/;
const RE_EXEC_END = /\n;\s*EXECUTABLE_BLOCK_END\s*(\n|$)/;
const RE_HEADER_START = /(^|\n);\s*HEADER_BLOCK_START\s*\n/;
const RE_HEADER_END = /\n;\s*HEADER_BLOCK_END\s*(\n|$)/;
const RE_FARM_MARKER = /;\s*(?:farm portal|FL_S[12])\b/i;

export function detectPrinter(gcode: string): PrinterId | null {
  let m;
  if ((m = RE_PRINTER_HEADER.exec(gcode))) {
    const n = m[1].toLowerCase().trim();
    if (n.startsWith('a1') && n.includes('mini')) return 'a1mini';
    if (n === 'a1') return 'a1';
    if (n === 'p1s' || n === 'p1p') return 'p1s';
    if (n === 'p2s') return 'p2s';
    if (n === 'x1c' || n === 'x1') return 'x1c';
  }
  if ((m = RE_PRINTER_CONFIG.exec(gcode))) {
    const n = m[1].toLowerCase();
    if (n.includes('a1 mini')) return 'a1mini';
    if (n.includes('a1'))      return 'a1';
    if (n.includes('p2s'))     return 'p2s';
    if (n.includes('p1s') || n.includes('p1p')) return 'p1s';
    if (n.includes('x1'))      return 'x1c';
  }
  if ((m = RE_PRINTER_MODEL_ID.exec(gcode))) {
    const id = m[1].trim().toUpperCase();
    const map: Record<string, PrinterId> = { N1S: 'a1mini', N2S: 'a1', C12: 'p1s', C13: 'p2s', C11: 'x1c' };
    return map[id] ?? null;
  }
  return null;
}

export function isAlreadyProcessed(gcode: string): boolean {
  return RE_FARM_MARKER.test(gcode);
}

export function parseHeaderMetrics(gcode: string): HeaderMetrics | null {
  const a = RE_HEADER_START.exec(gcode);
  const b = RE_HEADER_END.exec(gcode);
  if (!a || !b) return null;
  const block = gcode.slice(a.index + a[0].length, b.index);
  const get = (re: RegExp): string | null => { const x = re.exec(block); return x ? x[1].trim() : null; };
  const num = (s: string | null): number => (s == null ? NaN : parseFloat(s));
  return {
    modelTime: get(/;\s*model printing time:\s*([^;\n]+)/),
    totalTime: get(/;\s*total estimated time:\s*([^;\n]+)/),
    totalLayers: parseInt(get(/;\s*total layer number:\s*(\d+)/) ?? '0', 10) || 0,
    filamentLengthMm: num(get(/;\s*total filament length \[mm\]\s*:\s*([\d.,]+)/)) || 0,
    filamentVolumeCm3: num(get(/;\s*total filament volume \[cm\^3\]\s*:\s*([\d.,]+)/)) || 0,
    filamentWeightG: num(get(/;\s*total filament weight \[g\]\s*:\s*([\d.,]+)/)) || 0,
    maxZ: num(get(/;\s*max_z_height:\s*([\d.,]+)/)) || 0
  };
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const parts: string[] = [];
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  if (s || !parts.length) parts.push(s + 's');
  return parts.join(' ');
}

export function parseDurationStr(s: string | null | undefined): number {
  if (!s) return 0;
  let secs = 0;
  const re = /(\d+(?:\.\d+)?)\s*(h|m|s)/gi;
  let m;
  while ((m = re.exec(s))) {
    const v = parseFloat(m[1]);
    if (m[2].toLowerCase() === 'h') secs += v * 3600;
    else if (m[2].toLowerCase() === 'm') secs += v * 60;
    else secs += v;
  }
  return secs;
}

export function substitute(tpl: string, params: SubstituteParams): string {
  const p: SubstituteParams = { ...params };
  if (p.cooldownTarget != null && p.cooldownOvershoot != null && p.cooldownWaitAt == null) {
    p.cooldownWaitAt = Math.max(0, Number(p.cooldownTarget) - Number(p.cooldownOvershoot));
  }
  if (p.cooldown == null && p.cooldownTarget != null) p.cooldown = p.cooldownTarget;

  let out = tpl.replace(/\{if:([^}]+)\}([\s\S]*?)\{endif\}/g, (_m, key: string, body: string) => {
    const v = p[key.trim()];
    return (v && Number(v) > 0) ? body : '';
  });
  out = out.replace(/\{repeat:([^}]+)\}([\s\S]*?)\{endrepeat\}/g, (_m, key: string, body: string) => {
    const n = Math.max(0, parseInt(String(p[key.trim()] ?? 1), 10) || 0);
    return body.repeat(n);
  });
  return out.replace(/\{(\w+)\}/g, (m, key: string) => (p[key] !== undefined ? String(p[key]) : m));
}

export function injectGcode(gcode: string, opts: { pre?: string; post?: string }): string {
  const s = RE_EXEC_START.exec(gcode);
  const e = RE_EXEC_END.exec(gcode);
  if (!s || !e) throw new Error('EXECUTABLE_BLOCK markers not found.');
  const startInsert = s.index + s[0].length;
  const endInsert = e.index + 1;
  const before = gcode.slice(0, startInsert);
  const middle = gcode.slice(startInsert, endInsert).replace(/\n*$/, '\n');
  const after = gcode.slice(endInsert);
  return before + (opts.pre ? '\n' + opts.pre + '\n' : '') + middle + (opts.post ? opts.post + '\n' : '') + after;
}

export function extractExecutableBody(gcode: string): string {
  const s = RE_EXEC_START.exec(gcode);
  const e = RE_EXEC_END.exec(gcode);
  if (!s || !e) throw new Error('Missing EXECUTABLE_BLOCK markers.');
  return gcode.slice(s.index + s[0].length, e.index + 1);
}

export function stripLeadingLimits(body: string): string {
  const re = /^(?:[ \t]*(?:M73|M201|M203|M204|M205)[^\n]*\n){1,5}/;
  return body.replace(re, '');
}

export function buildMergedHeader(metricsList: HeaderSourceMetric[], sourceNames: string[]): string {
  const sum = (k: keyof HeaderMetrics) =>
    metricsList.reduce((a, x) => a + ((Number.isFinite(x.m[k] as number) ? (x.m[k] as number) : 0) * x.n), 0);
  const max = (k: keyof HeaderMetrics) =>
    metricsList.reduce((a, x) => Math.max(a, Number.isFinite(x.m[k] as number) ? (x.m[k] as number) : 0), 0);
  const modelSecs = metricsList.reduce((a, x) => a + parseDurationStr(x.m.modelTime) * x.n, 0);
  const totalSecs = metricsList.reduce((a, x) => a + parseDurationStr(x.m.totalTime) * x.n, 0);
  return [
    '; HEADER_BLOCK_START',
    '; farm portal merged — ' + sourceNames.length + ' source(s)',
    ...sourceNames.map((n) => '; source: ' + n),
    '; model printing time: ' + formatDuration(modelSecs),
    '; total estimated time: ' + formatDuration(totalSecs),
    '; total layer number: ' + Math.round(sum('totalLayers')),
    '; total filament length [mm] : ' + sum('filamentLengthMm').toFixed(2),
    '; total filament volume [cm^3] : ' + sum('filamentVolumeCm3').toFixed(2),
    '; total filament weight [g] : ' + sum('filamentWeightG').toFixed(2),
    '; max_z_height: ' + max('maxZ').toFixed(2),
    '; HEADER_BLOCK_END',
    ''
  ].join('\n');
}

export function diffInjection(original: string, injected: string): DiffLine[] {
  const oLines = original.split('\n');
  const iLines = injected.split('\n');
  const out: DiffLine[] = [];
  let o = 0, i = 0;
  while (i < iLines.length) {
    if (o < oLines.length && iLines[i] === oLines[o]) {
      if (out.length && out[out.length - 1].type === 'add') {
        out.push({ type: 'ctx', text: iLines[i] });
      }
      o++; i++;
    } else {
      const search = oLines.slice(o, o + 1).indexOf(iLines[i]);
      if (search === 0) { o++; i++; }
      else {
        if (!out.length || out[out.length - 1].type !== 'add') {
          for (let k = Math.max(0, o - 2); k < o; k++) {
            out.push({ type: 'ctx', text: oLines[k] });
          }
        }
        out.push({ type: 'add', text: iLines[i] });
        i++;
      }
    }
  }
  return out;
}

export { md5 };
