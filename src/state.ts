import { presetFor, type CostSettings, DEFAULT_COST } from './lib/presets';
import { detectPrinter, isAlreadyProcessed, parseHeaderMetrics,
         type PrinterId, type HeaderMetrics, type TuningParams } from './lib/gcode';

export type Step = 'hardware' | 'files' | 'tune' | 'review';

export type Job = {
  id: string;
  fileName: string;
  rawGcode: string;
  detectedPrinter: PrinterId | null;
  metrics: HeaderMetrics | null;
  alreadyProcessed: boolean;
  repeats: number;
  overrides: Partial<TuningParams>;
  error: string | null;
};

export type State = {
  step: Step;
  printer: PrinterId;
  jobs: Job[];
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
  cost: CostSettings;
  advancedOpen: boolean;
};

export type Action =
  | { type: 'goto'; step: Step }
  | { type: 'setPrinter'; printer: PrinterId }
  | { type: 'addJobs'; files: { name: string; text: string }[] }
  | { type: 'removeJob'; id: string }
  | { type: 'setJobRepeats'; id: string; repeats: number }
  | { type: 'setJobOverride'; id: string; patch: Partial<TuningParams> }
  | { type: 'setGlobalDefault'; patch: Partial<TuningParams> }
  | { type: 'setCustomTemplates'; templates: { pre?: string; post?: string } | null }
  | { type: 'setCost'; patch: Partial<CostSettings> }
  | { type: 'toggleAdvanced'; open?: boolean }
  | { type: 'hydrate'; partial: Partial<State> };

const DEFAULT_PRINTER: PrinterId = 'a1';

export function initialState(): State {
  return {
    step: 'hardware',
    printer: DEFAULT_PRINTER,
    jobs: [],
    globalDefaults: presetFor(DEFAULT_PRINTER).defaults,
    customTemplates: null,
    cost: { ...DEFAULT_COST },
    advancedOpen: false
  };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseFile(name: string, text: string): Job {
  let detectedPrinter: PrinterId | null = null;
  let metrics: HeaderMetrics | null = null;
  let alreadyProcessed = false;
  let error: string | null = null;
  try {
    detectedPrinter = detectPrinter(text);
    metrics = parseHeaderMetrics(text);
    alreadyProcessed = isAlreadyProcessed(text);
    if (!/EXECUTABLE_BLOCK_START/.test(text)) {
      error = 'Missing EXECUTABLE_BLOCK markers — not a Bambu Studio gcode export.';
    }
  } catch (e) {
    error = (e as Error).message;
  }
  return {
    id: uid(),
    fileName: name,
    rawGcode: text,
    detectedPrinter,
    metrics,
    alreadyProcessed,
    repeats: 1,
    overrides: {},
    error
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'goto':
      return { ...state, step: action.step };
    case 'setPrinter':
      return {
        ...state,
        printer: action.printer,
        globalDefaults: presetFor(action.printer).defaults
      };
    case 'addJobs':
      return { ...state, jobs: [...state.jobs, ...action.files.map((f) => parseFile(f.name, f.text))] };
    case 'removeJob':
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) };
    case 'setJobRepeats':
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === action.id ? { ...j, repeats: Math.max(1, action.repeats) } : j))
      };
    case 'setJobOverride':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, overrides: { ...j.overrides, ...action.patch } } : j
        )
      };
    case 'setGlobalDefault':
      return { ...state, globalDefaults: { ...state.globalDefaults, ...action.patch } };
    case 'setCustomTemplates':
      return { ...state, customTemplates: action.templates };
    case 'setCost':
      return { ...state, cost: { ...state.cost, ...action.patch } };
    case 'toggleAdvanced':
      return { ...state, advancedOpen: action.open ?? !state.advancedOpen };
    case 'hydrate':
      return { ...state, ...action.partial };
    default:
      return state;
  }
}
