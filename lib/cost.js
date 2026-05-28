// Per-print cost estimate. Returns dollars and breakdown lines.
import { parseDurationStr } from "./gcode.js";

export function estimateCost(metrics, cost) {
  const secs = parseDurationStr(metrics.totalTime || metrics.modelTime || "0s");
  const hours = secs / 3600;
  const grams = metrics.filamentWeightG || 0;

  const filament   = (grams / 1000) * cost.filamentPerKg;
  const power      = hours * (cost.printerWatts / 1000) * cost.electricityPerKwh;
  const labor      = (cost.laborMinutesPerPrint / 60) * cost.laborPerHour;
  const deprec     = hours * cost.depreciationPerHour;

  const subtotal = filament + power + labor + deprec;
  const fail = subtotal * (cost.failureRatePct / 100);
  const total = subtotal + fail;

  return {
    total,
    breakdown: [
      { label: "filament",      value: filament },
      { label: "electricity",   value: power },
      { label: "labor",         value: labor },
      { label: "depreciation",  value: deprec },
      { label: "failure buffer",value: fail }
    ]
  };
}

export function fmtMoney(n) {
  if (!isFinite(n)) return "—";
  if (n >= 1)    return "$" + n.toFixed(2);
  if (n >= 0.1)  return (n * 100).toFixed(0) + "¢";
  if (n >= 0.01) return (n * 100).toFixed(1) + "¢";
  if (n > 0)     return "<1¢";
  return "$0";
}
