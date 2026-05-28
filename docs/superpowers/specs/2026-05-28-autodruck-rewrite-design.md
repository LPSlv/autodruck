# Autodruck — Rewrite Design Spec

**Date:** 2026-05-28
**Status:** Approved (brainstorming output, ready for implementation plan)

## Goal

Rewrite the existing vanilla-JS `autodruck` (forked from Farmloop) as a TypeScript Vite + React + shadcn/ui single-page app. Keep full feature parity (gcode plate-detach injection, multi-job merge/loop, cost model, tufte-style charts, per-printer presets) but reshape the UI as a clean 4-step vertical wizard. Position the project as an open-source 3D printer farm automation tool, compatible with Farmloop stage-1 mechanical detach hardware.

## Non-goals

- `.3mf` import (current code only handles raw `.gcode`; defer to v2).
- Server, account, sync, or telemetry — fully offline browser tool.
- Dark mode in v1 (light only; shadcn theming makes v2 trivial).
- Marketing landing page or `/docs` route — single-page SPA. README does the marketing.
- GitHub Pages deploy automation — ship a build artifact, users self-host.

## Stack

- Vite + React 18 + TypeScript (strict)
- shadcn/ui (Tailwind under the hood)
- `pnpm`
- Vitest for unit tests, Playwright for one e2e smoke
- `client-zip` for "download each" (small, no JSZip bloat)
- License: GPL-3.0

## Architecture

Single React app driven by one `useReducer` (Approach A from brainstorming). No router; wizard step lives in reducer state. No external state lib.

### File layout

```
autodruck/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ tailwind.config.ts
├─ postcss.config.js
├─ components.json
├─ LICENSE                  GPL-3.0
├─ README.md                keyword-heavy marketing
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx               <WizardShell/> + useReducer
│  ├─ state.ts              reducer + actions + initial state
│  ├─ lib/                  ported pure logic, typed
│  │   ├─ gcode.ts
│  │   ├─ presets.ts
│  │   ├─ cost.ts
│  │   ├─ tufte.ts
│  │   ├─ store.ts          localStorage persistence
│  │   └─ md5.ts
│  ├─ steps/
│  │   ├─ Step1Hardware.tsx
│  │   ├─ Step2Files.tsx
│  │   ├─ Step3Tune.tsx
│  │   └─ Step4Review.tsx
│  ├─ components/
│  │   ├─ ui/               shadcn-generated
│  │   ├─ DropZone.tsx
│  │   ├─ JobRow.tsx
│  │   ├─ StatStrip.tsx
│  │   ├─ AdvancedSheet.tsx
│  │   └─ WizardShell.tsx
│  └─ test/
│      ├─ fixtures/
│      └─ lib/*.test.ts
├─ e2e/
│  └─ smoke.spec.ts
└─ .github/workflows/ci.yml
```

## State

One reducer in `src/state.ts`:

```ts
type PrinterId = 'a1'|'a1mini'|'p1s'|'p1p'|'p2s'|'x1c'|'h2s'|'h2d'|'h2c';
type Stage = 1 | 2;
type Step = 'hardware' | 'files' | 'tune' | 'review';

type Job = {
  id: string;
  fileName: string;
  rawGcode: string;
  detectedPrinter: PrinterId | null;
  metrics: HeaderMetrics | null;
  alreadyProcessed: boolean;
  repeats: number;                  // loop count for merge
  overrides: Partial<TuningParams>;
  error: string | null;
};

type State = {
  step: Step;
  printer: PrinterId;
  stage: Stage;
  jobs: Job[];
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
  cost: CostSettings;
  advancedOpen: boolean;
};
```

Reducer rules:
- `setPrinter` / `setStage` re-resolve `globalDefaults` from `presetFor(printer, stage).defaults`. Per-job `overrides` preserved.
- `addJobs` parses each file (`detectPrinter`, `parseHeaderMetrics`, `isAlreadyProcessed`). Failures populate `job.error`; no silent drops.
- `hydrate` runs once on mount; persists everything except `jobs`.
- `useEffect` debounces (300ms) and writes `(printer, stage, globalDefaults, customTemplates, cost)` to localStorage.

## Wizard flow

**Shell** — Top: app name + 4-dot progress + step title. `⋯` opens `AdvancedSheet`. Bottom: sticky `Back` / `Next` (or `Download merged ↵` on Step 4).

**Step 1 Hardware** — Two cards: printer (3-col grid of 9 selectable cards with build volume) and stage (Stage 1 manual ramp / Stage 2 powered actuator). No auto-advance.

**Step 2 Files** — Drop zone (`.gcode` only). Job list below. Each job: filename, detected-printer badge (yellow if mismatch), parsed time/filament, remove button. Red banner for parse errors, yellow chip for already-processed.

**Step 3 Tune** — Top card: resolved preset summary + `Edit defaults` button → opens AdvancedSheet tuning tab. Below: per-job collapsibles with loop stepper + optional overrides form.

**Step 4 Review** — Tufte stat strip (time / filament / cost with sparklines via the tufte skill). Cost breakdown table. Per-job summary. Primary `Download merged .gcode ↵`, ghost `Download each` (zip).

**AdvancedSheet** — Right-side shadcn Sheet, 3 tabs: Tuning (global defaults), Templates (pre/post gcode `Textarea`s with reset), Cost.

## Error handling

| Case | Behavior |
|------|----------|
| Missing `EXECUTABLE_BLOCK` markers | Job shown with red banner; not dropped |
| Printer mismatch (detected vs. selected) | Yellow chip on row; doesn't block |
| Already-processed file | Yellow chip; doesn't block |
| Mixed-printer batch on merge | Red banner on Step 4; merge blocked, "download each" still allowed |
| Empty jobs list | `Next` disabled |
| localStorage disabled/full | Swallow + console.warn; settings just don't persist |
| Large files (>5MB) | Show parsing toast; parsing stays sync in v1 (Web Worker deferred to v2) |
| `.3mf` upload | Reject in v1 with a clear message; defer to v2 |

## Filenames

- Merged: `autodruck_<printer>_s<stage>_<N>jobs_<md5short>.gcode` (`md5short` = first 8 hex chars of md5 over the merged output)
- Per-job: `<original_basename>__autodruck.gcode`

## Testing

**Vitest** unit tests over `src/lib/*` against fixtures `a1_stage1.gcode`, `p1s_stage2.gcode`, `headerless.gcode`, `already_processed.gcode`:
- `detectPrinter` for every family
- `parseHeaderMetrics` valid + missing
- `injectGcode` round-trip + boundary placement
- `buildMergedHeader` sum/max correctness
- `stripLeadingLimits` boundary safety
- `substitute` placeholders (`{var}`, `{if:…}`, `{repeat:…}`, derived `cooldownWaitAt`)

**Playwright** one e2e smoke: load → pick A1 → next → drop fixture → next → next → click Download merged → assert resulting file contains both `EXECUTABLE_BLOCK_START` and the FL marker.

**CI** `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm exec playwright test`.

## Build & deploy

- `vite.config.ts` with `base: './'` so build is path-agnostic for self-hosting.
- `pnpm build` → `dist/`. README documents `pnpm preview` for local serve and `npx serve dist` for trivial production hosting.
- No analytics, no CDN fonts. Fully offline-capable.

## README direction

Title: `autodruck — open-source 3D printer farm automation`

Subhead: "Browser-based G-code post-processor for unattended back-to-back printing on Bambu A1, A1 mini, P1S/P1P, P2S, X1C, and H-series. Compatible with Farmloop stage-1 mechanical detach hardware and 3D-printable parts."

Sections: What it does · Supported printers · How it works (one diagram) · Quickstart · Hardware (links Farmloop) · Privacy (everything local) · Build · License (GPL-3.0) · Roadmap.

Keywords woven in naturally: 3d printer farm, unattended printing, automatic part ejection, bambu lab, farmloop, gcode post-processor, plate cleaning, print loop, open source 3d printing, A1 farm, P1S farm, X1C farm.

## Out of scope (v2+)

- `.3mf` import (unzip + parse embedded `plate_*.gcode`)
- Web Worker offload for large file parsing
- Dark mode
- Multi-language UI
- Cloud-hosted version
- Webcam / OctoPrint integration
- Print queue scheduling

## Commit conventions

No `Claude` / AI references in commit messages. Plain dev-style conventional-commit-ish:
- `feat: vertical wizard scaffold`
- `feat(gcode): port detect/inject helpers to typescript`
- `test: add A1 stage-1 fixture coverage`
- `fix(merge): strip leading limits between concatenated jobs`
- `chore: GPL-3.0 license`
