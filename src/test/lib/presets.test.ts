import { describe, it, expect } from 'vitest';
import { PRINTERS, PRESETS, presetFor, presetLabel } from '@/lib/presets';

describe('presets', () => {
  it('has all 9 printers', () => {
    const ids = PRINTERS.map((p) => p.id).sort();
    expect(ids).toEqual(['a1', 'a1mini', 'h2c', 'h2d', 'h2s', 'p1p', 'p1s', 'p2s', 'x1c']);
  });
  it('returns stage 1 and 2 for each printer', () => {
    for (const p of PRINTERS) {
      expect(PRESETS[p.id][1]).toBeDefined();
      expect(PRESETS[p.id][2]).toBeDefined();
    }
  });
  it('presetFor returns object with pre/post/defaults', () => {
    const ps = presetFor('a1', 1);
    expect(ps.pre).toMatch(/farm portal/);
    expect(ps.post).toMatch(/stage 1 detachment/);
    expect(ps.defaults.cooldownTarget).toBeGreaterThan(0);
  });
  it('presetLabel formats nicely', () => {
    expect(presetLabel('a1mini', 2)).toBe('A1 mini · Stage 2');
  });
  it('A1 stage 2 has bigger return sweep than stage 1', () => {
    expect(PRESETS.a1[2].defaults.returnx).toBeGreaterThan(PRESETS.a1[1].defaults.returnx);
  });
});
