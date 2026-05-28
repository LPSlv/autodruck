import { PRINTERS } from './presets';
import type { PrinterId, TuningParams } from './gcode';
import type { Stage, CostSettings } from './presets';

const KEY = 'autodruck:v1';

const PRINTER_IDS = new Set(PRINTERS.map((p) => p.id));

export type Persisted = {
  printer?: PrinterId;
  stage?: Stage;
  globalDefaults?: TuningParams;
  customTemplates?: { pre?: string; post?: string } | null;
  cost?: CostSettings;
};

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Persisted = {};
    if (typeof parsed.printer === 'string' && PRINTER_IDS.has(parsed.printer as PrinterId)) {
      out.printer = parsed.printer as PrinterId;
    }
    if (parsed.stage === 1 || parsed.stage === 2) out.stage = parsed.stage;
    if (parsed.globalDefaults && typeof parsed.globalDefaults === 'object') {
      out.globalDefaults = parsed.globalDefaults as TuningParams;
    }
    if (parsed.customTemplates === null || (parsed.customTemplates && typeof parsed.customTemplates === 'object')) {
      out.customTemplates = parsed.customTemplates as Persisted['customTemplates'];
    }
    if (parsed.cost && typeof parsed.cost === 'object') {
      out.cost = parsed.cost as CostSettings;
    }
    return out;
  } catch {
    return {};
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // swallow quota / disabled storage
    console.warn('autodruck: localStorage write failed');
  }
}
