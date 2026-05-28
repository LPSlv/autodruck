// Minimal observable state. No framework.
import { PRESETS, DEFAULT_COST, presetFor } from "./presets.js";

const KEY = "farm.v2.state";

function loadInitial() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        printer: s.printer || "a1",
        stage: s.stage || 1,
        // overlay over PRESETS — only stores user edits
        templates: s.templates || {},
        defaults: s.defaults || {},
        cost: { ...DEFAULT_COST, ...(s.cost || {}) },
        presets: Array.isArray(s.presets) ? s.presets : []
      };
    }
  } catch (e) { /* fallthrough */ }
  return { printer: "a1", stage: 1, templates: {}, defaults: {}, cost: { ...DEFAULT_COST }, presets: [] };
}

const persisted = loadInitial();

export const state = {
  ...persisted,
  jobs: [], // runtime only — files can't be persisted across reloads
  expandedId: null,
  paletteOpen: false,
  drawerOpen: false,
  drawerSection: "tuning"
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function notify() {
  // Persist a subset
  try {
    localStorage.setItem(KEY, JSON.stringify({
      printer: state.printer, stage: state.stage,
      templates: state.templates, defaults: state.defaults,
      cost: state.cost, presets: state.presets
    }));
  } catch (e) {}
  for (const fn of subs) fn(state);
}

export function activePreset() {
  const base = presetFor(state.printer, state.stage);
  const key = `${state.printer}_${state.stage}`;
  const tplOverride = state.templates[key] || {};
  const defOverride = state.defaults[key] || {};
  return {
    pre: tplOverride.pre ?? base.pre,
    post: tplOverride.post ?? base.post,
    defaults: { ...base.defaults, ...defOverride }
  };
}

export function effectiveParams(jobOverrides = {}) {
  const p = activePreset();
  return { ...p.defaults, ...jobOverrides };
}

export function saveTemplate({ pre, post }) {
  const key = `${state.printer}_${state.stage}`;
  state.templates[key] = { pre, post };
  notify();
}
export function restoreTemplate() {
  const key = `${state.printer}_${state.stage}`;
  delete state.templates[key];
  notify();
}
export function setDefaults(partial) {
  const key = `${state.printer}_${state.stage}`;
  state.defaults[key] = { ...(state.defaults[key] || {}), ...partial };
  notify();
}
export function resetDefaults() {
  const key = `${state.printer}_${state.stage}`;
  delete state.defaults[key];
  notify();
}
export function setCost(partial) { state.cost = { ...state.cost, ...partial }; notify(); }
export function setHardware(printer, stage) {
  state.printer = printer; state.stage = stage;
  notify();
}

let JOB_NEXT = 1;
export function makeJob(file) { return { id: JOB_NEXT++, file, name: file.name, loop: 1, status: "pending", overrides: {} }; }
export function addJob(job) { state.jobs.push(job); notify(); }
export function removeJob(id) { const i = state.jobs.findIndex((j) => j.id === id); if (i >= 0) state.jobs.splice(i, 1); if (state.expandedId === id) state.expandedId = null; notify(); }
export function updateJob(id, patch) {
  const j = state.jobs.find((x) => x.id === id);
  if (j) Object.assign(j, patch);
  notify();
}
export function toggleExpand(id) {
  state.expandedId = state.expandedId === id ? null : id;
  notify();
}
export function savePreset(name) {
  const key = `${state.printer}_${state.stage}`;
  state.presets.push({ name, printer: state.printer, stage: state.stage, defaults: { ...state.defaults[key], ...activePreset().defaults } });
  notify();
}
export function applyPreset(idx) {
  const p = state.presets[idx];
  if (!p) return;
  state.printer = p.printer; state.stage = p.stage;
  state.defaults[`${p.printer}_${p.stage}`] = { ...p.defaults };
  notify();
}
export function deletePreset(idx) { state.presets.splice(idx, 1); notify(); }
