import type { HeaderMetrics } from './gcode';
import type { CostSettings } from './presets';
import { parseDurationStr } from './gcode';

export type CostBreakdown = {
  filament: number;
  electricity: number;
  labor: number;
  depreciation: number;
  failureAdjustment: number;
  total: number;
};

export function computeCost(
  metrics: HeaderMetrics,
  settings: CostSettings,
  repeats: number
): CostBreakdown {
  const hours = parseDurationStr(metrics.totalTime) / 3600;
  const filamentKg = (metrics.filamentWeightG / 1000) * repeats;
  const filament = filamentKg * settings.filamentPerKg;
  const electricity = hours * repeats * (settings.printerWatts / 1000) * settings.electricityPerKwh;
  const labor = (settings.laborMinutesPerPrint / 60) * settings.laborPerHour * repeats;
  const depreciation = hours * repeats * settings.depreciationPerHour;
  const subtotal = filament + electricity + labor + depreciation;
  const failureAdjustment = subtotal * (settings.failureRatePct / 100);
  const total = subtotal + failureAdjustment;
  return { filament, electricity, labor, depreciation, failureAdjustment, total };
}
