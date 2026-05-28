import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectPrinter,
  parseHeaderMetrics,
  isAlreadyProcessed,
  injectGcode,
  extractExecutableBody,
  stripLeadingLimits,
  buildMergedHeader,
  substitute,
  parseDurationStr,
  formatDuration
} from '@/lib/gcode';

const fx = (name: string) =>
  readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

describe('detectPrinter', () => {
  it('detects A1 from machine header', () => {
    expect(detectPrinter(fx('a1_stage1.gcode'))).toBe('a1');
  });
  it('detects P1S', () => {
    expect(detectPrinter(fx('p1s_stage2.gcode'))).toBe('p1s');
  });
  it('returns null for headerless', () => {
    expect(detectPrinter(fx('headerless.gcode'))).toBeNull();
  });
  it('detects nothing on truly empty input', () => {
    expect(detectPrinter('')).toBeNull();
  });

  it.each([
    ['; ========== machine: A1 mini ==========', 'a1mini'],
    ['; ========== machine: P2S ==========', 'p2s'],
    ['; ========== machine: X1C ==========', 'x1c'],
    ['; ========== machine: P1P ==========', 'p1s'], // P1P maps to p1s in detector
    ['; printer_model_id = C13', 'p2s'],
    ['; printer_model_id = C11', 'x1c'],
  ])('detects %s as %s', (header, expected) => {
    expect(detectPrinter(header)).toBe(expected);
  });
});

describe('isAlreadyProcessed', () => {
  it('flags processed file', () => {
    expect(isAlreadyProcessed(fx('already_processed.gcode'))).toBe(true);
  });
  it('does not flag fresh file', () => {
    expect(isAlreadyProcessed(fx('a1_stage1.gcode'))).toBe(false);
  });
});

describe('parseHeaderMetrics', () => {
  it('extracts A1 metrics', () => {
    const m = parseHeaderMetrics(fx('a1_stage1.gcode'))!;
    expect(m.totalLayers).toBe(120);
    expect(m.filamentWeightG).toBeCloseTo(6.74);
    expect(m.maxZ).toBeCloseTo(24.5);
    expect(parseDurationStr(m.totalTime)).toBe(5400);
  });
  it('returns null when HEADER_BLOCK missing', () => {
    expect(parseHeaderMetrics(fx('headerless.gcode'))).toBeNull();
  });
});

describe('injectGcode', () => {
  it('inserts pre at start and post at end of executable block', () => {
    const out = injectGcode(fx('a1_stage1.gcode'), { pre: '; FL_PRE', post: '; FL_POST' });
    const body = extractExecutableBody(out);
    expect(body.startsWith('\n; FL_PRE')).toBe(true);
    expect(body.trimEnd().endsWith('; FL_POST')).toBe(true);
  });
  it('throws when markers missing', () => {
    expect(() => injectGcode(fx('headerless.gcode'), { pre: 'x', post: 'y' })).toThrow();
  });
});

describe('stripLeadingLimits', () => {
  it('removes leading M73/M201/M203/M204/M205 lines', () => {
    const body = extractExecutableBody(fx('p1s_stage2.gcode'));
    const stripped = stripLeadingLimits(body);
    expect(stripped.startsWith('G28')).toBe(true);
  });
  it('leaves body unchanged when no leading limits', () => {
    const body = '\nG28\nG1 X1\n';
    expect(stripLeadingLimits(body)).toBe(body);
  });
});

describe('buildMergedHeader', () => {
  it('sums weights and layers across jobs with repeats', () => {
    const m = parseHeaderMetrics(fx('a1_stage1.gcode'))!;
    const header = buildMergedHeader(
      [{ m, n: 2 }, { m, n: 1 }],
      ['a.gcode', 'b.gcode']
    );
    expect(header).toContain('HEADER_BLOCK_START');
    expect(header).toContain('HEADER_BLOCK_END');
    expect(header).toMatch(/total filament weight \[g\] : 20\.22/);
    expect(header).toMatch(/total layer number: 360/);
  });
});

describe('substitute', () => {
  it('replaces {var}', () => {
    expect(substitute('a {x} b', { x: 7 })).toBe('a 7 b');
  });
  it('emits {if:flag} body only when truthy', () => {
    expect(substitute('x{if:f}Y{endif}z', { f: 1 })).toBe('xYz');
    expect(substitute('x{if:f}Y{endif}z', { f: 0 })).toBe('xz');
  });
  it('repeats {repeat:n} body n times', () => {
    expect(substitute('[{repeat:n}.{endrepeat}]', { n: 3 })).toBe('[...]');
  });
  it('derives cooldownWaitAt = target - overshoot', () => {
    expect(substitute('{cooldownWaitAt}', { cooldownTarget: 25, cooldownOvershoot: 5 })).toBe('20');
  });
});

describe('formatDuration', () => {
  it('formats seconds compactly', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
    expect(formatDuration(0)).toBe('0s');
  });
});
