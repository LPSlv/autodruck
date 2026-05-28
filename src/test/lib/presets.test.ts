import { describe, it, expect } from 'vitest';
import { PRINTERS, PRESETS, presetFor, presetLabel } from '@/lib/presets';

describe('presets', () => {
  it('has all 9 printers', () => {
    const ids = PRINTERS.map((p) => p.id).sort();
    expect(ids).toEqual(['a1', 'a1mini', 'h2c', 'h2d', 'h2s', 'p1p', 'p1s', 'p2s', 'x1c']);
  });
  it('has a preset for each printer', () => {
    for (const p of PRINTERS) {
      expect(PRESETS[p.id]).toBeDefined();
    }
  });
  it('presetFor returns object with pre/post/defaults', () => {
    const ps = presetFor('a1');
    expect(ps.pre).toMatch(/farm portal/);
    expect(ps.post).toMatch(/stage 1 detachment/);
    expect(ps.defaults.cooldownTarget).toBeGreaterThan(0);
  });
  it('presetLabel formats nicely', () => {
    expect(presetLabel('a1mini')).toBe('A1 mini');
  });
});
