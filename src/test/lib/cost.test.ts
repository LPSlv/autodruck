import { describe, it, expect } from 'vitest';
import { computeCost } from '@/lib/cost';
import { DEFAULT_COST } from '@/lib/presets';
import type { HeaderMetrics } from '@/lib/gcode';

const m: HeaderMetrics = {
  modelTime: '1h',
  totalTime: '1h',
  totalLayers: 100,
  filamentLengthMm: 1000,
  filamentVolumeCm3: 2.5,
  filamentWeightG: 10,
  maxZ: 20
};

describe('computeCost', () => {
  it('scales linearly with repeats', () => {
    const a = computeCost(m, DEFAULT_COST, 1);
    const b = computeCost(m, DEFAULT_COST, 4);
    expect(b.total).toBeCloseTo(a.total * 4, 5);
  });
  it('filament cost matches kg × price', () => {
    const { filament } = computeCost(m, DEFAULT_COST, 2);
    expect(filament).toBeCloseTo((10 / 1000) * 2 * DEFAULT_COST.filamentPerKg, 5);
  });
  it('includes failure adjustment proportional to subtotal', () => {
    const cs = { ...DEFAULT_COST, failureRatePct: 10 };
    const c = computeCost(m, cs, 1);
    expect(c.failureAdjustment).toBeCloseTo(
      (c.filament + c.electricity + c.labor + c.depreciation) * 0.1,
      5
    );
  });
});
