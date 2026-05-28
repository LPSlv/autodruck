# Autodruck Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the vanilla-JS autodruck app as a TypeScript Vite + React + shadcn/ui single-page wizard, preserving all gcode injection / merge / preset / cost / chart features, with tests, a marketing-heavy README, and GPL-3.0 license.

**Architecture:** Single SPA, one `useReducer` driving a 4-step vertical wizard. Pure logic ported as typed modules under `src/lib/`. shadcn/ui for primitives, Tailwind for layout, Vitest + Playwright for tests. No router, no backend.

**Tech Stack:** Vite 5 + React 18 + TypeScript (strict) + Tailwind 3 + shadcn/ui + pnpm + Vitest + Playwright + client-zip.

**Commit conventions:** Plain conventional-commits style, no `Claude` / AI references anywhere. Use a real author identity (default during execution: `Lenards <lenards@optonics.eu>`).

---

## File map (locked at plan time)

```
autodruck/
├─ index.html, vite.config.ts, tsconfig.json, tsconfig.node.json
├─ package.json, pnpm-lock.yaml
├─ tailwind.config.ts, postcss.config.js, components.json
├─ .gitignore (extended)
├─ LICENSE                                  (GPL-3.0 plain text)
├─ README.md                                (rewritten, keyword-heavy)
├─ src/
│  ├─ main.tsx                              react root + globals.css
│  ├─ globals.css                           tailwind base + shadcn vars
│  ├─ App.tsx                               <WizardShell/> + reducer wiring
│  ├─ state.ts                              State, Action, reducer, initialState
│  ├─ lib/
│  │   ├─ md5.ts                            (verbatim port + types)
│  │   ├─ gcode.ts                          parse/detect/inject/merge/diff
│  │   ├─ presets.ts                        PRINTERS, PRESETS, DEFAULT_COST helpers
│  │   ├─ cost.ts                           computeCost(metrics, settings, repeats)
│  │   ├─ tufte.ts                          sparkline path helpers
│  │   └─ store.ts                          load/save settings to localStorage
│  ├─ steps/
│  │   ├─ Step1Hardware.tsx
│  │   ├─ Step2Files.tsx
│  │   ├─ Step3Tune.tsx
│  │   └─ Step4Review.tsx
│  └─ components/
│      ├─ ui/                               shadcn-generated (button, card, sheet, …)
│      ├─ WizardShell.tsx
│      ├─ DropZone.tsx
│      ├─ JobRow.tsx
│      ├─ StatStrip.tsx
│      ├─ AdvancedSheet.tsx
│      └─ Sparkline.tsx
├─ src/test/
│  ├─ fixtures/
│  │   ├─ a1_stage1.gcode
│  │   ├─ p1s_stage2.gcode
│  │   ├─ headerless.gcode
│  │   └─ already_processed.gcode
│  └─ lib/
│      ├─ gcode.test.ts
│      ├─ presets.test.ts
│      └─ cost.test.ts
├─ e2e/
│  ├─ playwright.config.ts
│  └─ smoke.spec.ts
└─ .github/workflows/ci.yml
```

Old files removed in the final task (after parity is verified): `main.js`, `styles.css`, `lib/*.js`, the legacy root `index.html` (replaced by Vite's).

---

## Pre-task setup

The repo is already cloned at `~/autodruck`. Work happens on `main`. Each task ends in a commit. **Do not include `Claude` or `Co-Authored-By: Claude` in any commit message.** Set git identity before the first commit if not already set:

```bash
cd ~/autodruck
git config user.name "Lenards"
git config user.email "lenards@optonics.eu"
```

---

### Task 1: Scaffold Vite + React + TypeScript

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html` (overwrite the existing one), `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `.gitignore` (extend)
- Modify: none of the legacy `lib/*.js` yet — they stay until Task 14.

- [ ] **Step 1: Move the legacy entry out of the way**

```bash
cd ~/autodruck
mv index.html legacy-index.html
mv main.js legacy-main.js
mv styles.css legacy-styles.css
```

(They get deleted in the final task once parity is confirmed.)

- [ ] **Step 2: Scaffold Vite project in place using the template**

```bash
cd ~/autodruck
pnpm create vite@latest . --template react-ts
# When asked to overwrite, answer Yes (the legacy index.html is already moved, and .git is preserved by Vite's scaffolder)
```

- [ ] **Step 3: Tighten TS config**

Overwrite `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "e2e"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Update `vite.config.ts` with path alias + relative base**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: { port: 5173 }
});
```

- [ ] **Step 5: Add `.gitignore` lines for the new toolchain**

Append to `.gitignore`:

```
node_modules
dist
.vite
.DS_Store
*.tsbuildinfo
playwright-report
test-results
.env*
```

- [ ] **Step 6: Verify dev server boots**

```bash
cd ~/autodruck
pnpm install
pnpm dev --port 5173 &
sleep 2
curl -s http://localhost:5173 | grep -q "Vite + React" && echo OK || echo FAIL
kill %1
```

Expected: `OK`. If FAIL, fix before continuing.

- [ ] **Step 7: Commit**

```bash
cd ~/autodruck
git add -A
git commit -m "chore: scaffold vite react typescript project"
```

---

### Task 2: Tailwind + shadcn/ui setup

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`, `src/globals.css`, `components.json`
- Modify: `src/main.tsx` (import globals.css)

- [ ] **Step 1: Install Tailwind + shadcn deps**

```bash
cd ~/autodruck
pnpm add -D tailwindcss@3 postcss autoprefixer @types/node
pnpm add class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate
pnpm exec tailwindcss init -p
```

- [ ] **Step 2: Replace `tailwind.config.js` with TS version**

Delete the generated `tailwind.config.js` and create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1100px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [animate]
} satisfies Config;
```

- [ ] **Step 3: Create `src/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 10%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 10%;
    --primary: 240 6% 12%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 12%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 240 5% 96%;
    --accent-foreground: 240 6% 12%;
    --destructive: 0 72% 50%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 240 6% 12%;
    --radius: 0.5rem;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; font-feature-settings: "rlig" 1, "calt" 1; }
}
```

- [ ] **Step 4: Wire globals into `src/main.tsx`**

Replace `src/main.tsx` with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Remove any auto-generated `src/index.css` / `src/App.css`.

- [ ] **Step 5: Add `components.json` for shadcn CLI**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: Create `src/lib/utils.ts` (shadcn helper)**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Generate shadcn primitives**

```bash
cd ~/autodruck
pnpm dlx shadcn@latest add button card input label textarea badge sheet tabs collapsible table sonner separator --yes
```

If any prompt asks for overwrite/path, accept defaults.

- [ ] **Step 8: Replace `src/App.tsx` with a minimal placeholder so dev server still boots**

```tsx
export default function App() {
  return (
    <main className="container py-12">
      <h1 className="text-2xl font-semibold">autodruck</h1>
      <p className="text-muted-foreground">scaffold ready</p>
    </main>
  );
}
```

- [ ] **Step 9: Verify**

```bash
pnpm dev --port 5173 &
sleep 2
curl -s http://localhost:5173 | grep -q '<div id="root"></div>' && echo OK || echo FAIL
kill %1
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: tailwind and shadcn ui primitives"
```

---

### Task 3: Vitest setup

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Install Vitest**

```bash
cd ~/autodruck
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `"scripts"` block ensure these exist (merge, don't overwrite):

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Sanity-check**

```bash
pnpm test
```

Expected: `No test files found` (acceptable — exits 0 with `--passWithNoTests` is not set, so add it or accept "no test files" exit). If the exit code is non-zero, add `--passWithNoTests` to the script:

```json
"test": "vitest run --passWithNoTests"
```

Then re-run.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: configure vitest with jsdom"
```

---

### Task 4: Port `lib/md5.ts`

**Files:**
- Create: `src/lib/md5.ts`

- [ ] **Step 1: Port the legacy MD5 verbatim with types**

Copy `legacy-main.js`'s upstream `lib/md5.js` (still present at `lib/md5.js` in the repo before legacy cleanup — read it). The function shape is `md5(input: string): string`. Create `src/lib/md5.ts`:

Read `lib/md5.js` and copy the implementation into `src/lib/md5.ts`. At the top of the file add:

```ts
// MD5 — pure function, no DOM, no IO. Ported as-is from the legacy lib/md5.js.
```

At the bottom export:

```ts
export function md5(input: string): string {
  // existing implementation body, with parameter type added
}
```

If the legacy file used `function md5(...)` plus `export { md5 }`, you may keep `export { md5 }` and just add the `: string` parameter and `: string` return annotation.

- [ ] **Step 2: Add a tiny smoke test**

Create `src/test/lib/md5.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { md5 } from '@/lib/md5';

describe('md5', () => {
  it('hashes empty string to known value', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
  it('hashes "abc"', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});
```

- [ ] **Step 3: Run**

```bash
pnpm test
```

Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(lib): port md5 to typescript"
```

---

### Task 5: Port `lib/gcode.ts` (typed) + fixtures + tests

**Files:**
- Create: `src/lib/gcode.ts`, `src/test/lib/gcode.test.ts`, `src/test/fixtures/a1_stage1.gcode`, `src/test/fixtures/p1s_stage2.gcode`, `src/test/fixtures/headerless.gcode`, `src/test/fixtures/already_processed.gcode`

- [ ] **Step 1: Create the four fixture files**

Each is a minimal-but-realistic Bambu-style snippet. Create `src/test/fixtures/a1_stage1.gcode`:

```
; HEADER_BLOCK_START
; ========== machine: A1 ==========
; printer_model = Bambu Lab A1
; printer_model_id = N2S
; model printing time: 1h 23m 45s
; total estimated time: 1h 30m 0s
; total layer number: 120
; total filament length [mm] : 2345.67
; total filament volume [cm^3] : 5.62
; total filament weight [g] : 6.74
; max_z_height: 24.50
; HEADER_BLOCK_END

; EXECUTABLE_BLOCK_START
M73 P0 R90
M201 X10000 Y10000
G28
G1 Z5 F600
G1 X10 Y10
; ... print body ...
G1 X100 Y100
; EXECUTABLE_BLOCK_END
; printable end
```

Create `src/test/fixtures/p1s_stage2.gcode` (same shape, swap printer info):

```
; HEADER_BLOCK_START
; ========== machine: P1S ==========
; printer_model = Bambu Lab P1S
; printer_model_id = C12
; model printing time: 0h 45m 10s
; total estimated time: 0h 50m 0s
; total layer number: 60
; total filament length [mm] : 1100.00
; total filament volume [cm^3] : 2.65
; total filament weight [g] : 3.18
; max_z_height: 12.00
; HEADER_BLOCK_END

; EXECUTABLE_BLOCK_START
M73 P0 R50
M201 X10000 Y10000
M203 X500 Y500
M204 P10000
M205 X9 Y9
G28
G1 Z5 F600
; print body
; EXECUTABLE_BLOCK_END
```

Create `src/test/fixtures/headerless.gcode`:

```
G28
G1 Z5 F600
G1 X100 Y100
M84
```

Create `src/test/fixtures/already_processed.gcode`:

```
; HEADER_BLOCK_START
; ========== machine: A1 ==========
; HEADER_BLOCK_END

; EXECUTABLE_BLOCK_START
G28
; --- farm portal · stage 1 detachment ---
; FL_S1
G1 X10 Y10
; EXECUTABLE_BLOCK_END
```

- [ ] **Step 2: Port `lib/gcode.js` to `src/lib/gcode.ts` with types**

Copy the existing `lib/gcode.js` content. Convert to TS. Type signatures:

```ts
import { md5 } from './md5';

export type PrinterId = 'a1' | 'a1mini' | 'p1s' | 'p1p' | 'p2s' | 'x1c' | 'h2s' | 'h2d' | 'h2c';

export type HeaderMetrics = {
  modelTime: string | null;
  totalTime: string | null;
  totalLayers: number;
  filamentLengthMm: number;
  filamentVolumeCm3: number;
  filamentWeightG: number;
  maxZ: number;
};

export type TuningParams = {
  cooldownTarget: number;
  cooldownOvershoot: number;
  cooldownWaitAt?: number;
  cooldown?: number;
  dwell: number;
  bedTempReheat: number;
  nozzleTempIdle: number;
  zlift: number;
  repeats: number;
  pushx: number;
  returnx: number;
  pushspeed: number;
  returnspeed: number;
  parky: number;
  parkz: number;
};

export type SubstituteParams = Partial<TuningParams> & Record<string, string | number | boolean | undefined>;

export type HeaderSourceMetric = { m: HeaderMetrics; n: number };

export type DiffLine = { type: 'add' | 'ctx'; text: string };

const RE_PRINTER_HEADER = /;\s*=+\s*machine:\s*([^\s=]+(?:\s+mini)?)/i;
const RE_PRINTER_CONFIG = /;\s*printer_model\s*=\s*([^\n]+)/i;
const RE_PRINTER_MODEL_ID = /;\s*printer_model_id\s*=\s*([^\n]+)/i;
const RE_EXEC_START = /(^|\n);\s*EXECUTABLE_BLOCK_START\s*\n/;
const RE_EXEC_END = /\n;\s*EXECUTABLE_BLOCK_END\s*(\n|$)/;
const RE_HEADER_START = /(^|\n);\s*HEADER_BLOCK_START\s*\n/;
const RE_HEADER_END = /\n;\s*HEADER_BLOCK_END\s*(\n|$)/;
const RE_FARM_MARKER = /;\s*(?:farm portal|FL_S[12])\b/i;

export function detectPrinter(gcode: string): PrinterId | null { /* port body */ }
export function isAlreadyProcessed(gcode: string): boolean { return RE_FARM_MARKER.test(gcode); }
export function parseHeaderMetrics(gcode: string): HeaderMetrics | null { /* port body */ }
export function formatDuration(seconds: number): string { /* port body */ }
export function parseDurationStr(s: string | null | undefined): number { /* port body */ }
export function substitute(tpl: string, params: SubstituteParams): string { /* port body */ }
export function injectGcode(gcode: string, opts: { pre?: string; post?: string }): string { /* port body */ }
export function extractExecutableBody(gcode: string): string { /* port body */ }
export function stripLeadingLimits(body: string): string { /* port body */ }
export function buildMergedHeader(metricsList: HeaderSourceMetric[], sourceNames: string[]): string { /* port body */ }
export function diffInjection(original: string, injected: string): DiffLine[] { /* port body */ }
export { md5 };
```

Fill in each body verbatim from `lib/gcode.js`. Tighten the `detectPrinter` return type: the legacy code returns `string | null`; narrow it to `PrinterId | null` (the literal IDs already match).

- [ ] **Step 3: Write tests `src/test/lib/gcode.test.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all green. If any fail, fix the port (most likely a regex translation issue), not the test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(gcode): port detect, parse, inject, merge helpers to typescript"
```

---

### Task 6: Port `lib/presets.ts`

**Files:**
- Create: `src/lib/presets.ts`, `src/test/lib/presets.test.ts`

- [ ] **Step 1: Port `lib/presets.js` to `src/lib/presets.ts`**

Copy verbatim. Add types:

```ts
import type { PrinterId, TuningParams } from './gcode';

export type Stage = 1 | 2;

export type PrinterMeta = {
  id: PrinterId;
  label: string;
  modelIds: string[];
  buildVolume: [number, number, number];
};

export type Preset = {
  pre: string;
  post: string;
  defaults: TuningParams;
};

export type CostSettings = {
  filamentPerKg: number;
  electricityPerKwh: number;
  printerWatts: number;
  laborPerHour: number;
  laborMinutesPerPrint: number;
  depreciationPerHour: number;
  failureRatePct: number;
};

export const PRINTERS: PrinterMeta[] = [ /* port */ ];

export const PRESETS: Record<PrinterId, Record<Stage, Preset>> = { /* port */ };

export const DEFAULT_COST: CostSettings = { /* port */ };

export function presetFor(printer: PrinterId, stage: Stage): Preset { /* port */ }
export function presetLabel(printer: PrinterId, stage: Stage): string { /* port */ }
```

- [ ] **Step 2: Write `src/test/lib/presets.test.ts`**

```ts
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
```

- [ ] **Step 3: Run**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(presets): port printer presets and tuning defaults to typescript"
```

---

### Task 7: Port `lib/cost.ts` + tests

**Files:**
- Create: `src/lib/cost.ts`, `src/test/lib/cost.test.ts`

- [ ] **Step 1: Read existing `lib/cost.js` and port**

The legacy file is short (37 lines). It exposes a single `computeCost` function. Recreate as `src/lib/cost.ts` with types:

```ts
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
```

If the legacy `lib/cost.js` shape differs, reconcile to whichever yields the same numerical answer for `metrics={totalTime:'1h',filamentWeightG:10}, settings=DEFAULT_COST, repeats=1` — write the test first (next step) and iterate.

- [ ] **Step 2: Tests `src/test/lib/cost.test.ts`**

```ts
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
```

- [ ] **Step 3: Run & iterate**

```bash
pnpm test
```

If linearity fails, the legacy `cost.js` may apply repeats differently — match that, but the spec is clear: scale linearly with repeats. Use the implementation above unless the legacy says otherwise; the tests are the source of truth.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cost): port cost model to typescript"
```

---

### Task 8: Port `lib/tufte.ts` and `lib/store.ts`

**Files:**
- Create: `src/lib/tufte.ts`, `src/lib/store.ts`

- [ ] **Step 1: Port `lib/tufte.js`**

Read legacy `lib/tufte.js`. It exposes sparkline path-generation helpers. Port as `src/lib/tufte.ts` with types:

```ts
export type SparkPoint = number;

export function sparklinePath(
  values: SparkPoint[],
  opts: { width: number; height: number; pad?: number }
): { d: string; min: number; max: number } {
  // port the legacy logic; if legacy file used a different API,
  // keep the legacy export name and wrap it here.
}
```

If the legacy file already exports a clean function, copy it as-is and add the parameter/return types.

- [ ] **Step 2: Port `lib/store.ts`**

Read legacy `lib/store.js`. It saves/loads from localStorage. Port:

```ts
const KEY = 'autodruck:v1';

export type Persisted = {
  printer?: string;
  stage?: number;
  globalDefaults?: unknown;
  customTemplates?: unknown;
  cost?: unknown;
};

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Persisted;
  } catch {
    return {};
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // swallow quota / disabled storage
  }
}
```

(The legacy `KEY` may be `'farm:v1'` — switch to `'autodruck:v1'` since this is a rebrand.)

- [ ] **Step 3: Smoke test (no Vitest needed; covered by typecheck + later e2e)**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(lib): port tufte sparklines and localStorage helpers"
```

---

### Task 9: State reducer

**Files:**
- Create: `src/state.ts`

- [ ] **Step 1: Write `src/state.ts`**

```ts
import { presetFor, type Stage, type CostSettings, DEFAULT_COST } from './lib/presets';
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
  stage: Stage;
  jobs: Job[];
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
  cost: CostSettings;
  advancedOpen: boolean;
};

export type Action =
  | { type: 'goto'; step: Step }
  | { type: 'setPrinter'; printer: PrinterId }
  | { type: 'setStage'; stage: Stage }
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
const DEFAULT_STAGE: Stage = 1;

export function initialState(): State {
  return {
    step: 'hardware',
    printer: DEFAULT_PRINTER,
    stage: DEFAULT_STAGE,
    jobs: [],
    globalDefaults: presetFor(DEFAULT_PRINTER, DEFAULT_STAGE).defaults,
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
        globalDefaults: presetFor(action.printer, state.stage).defaults
      };
    case 'setStage':
      return {
        ...state,
        stage: action.stage,
        globalDefaults: presetFor(state.printer, action.stage).defaults
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
```

- [ ] **Step 2: Tests (optional but quick)**

Create `src/test/state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialState, reducer } from '@/state';

describe('reducer', () => {
  it('setPrinter re-resolves global defaults', () => {
    const s0 = initialState();
    const a1Zlift = s0.globalDefaults.zlift;
    const s1 = reducer(s0, { type: 'setPrinter', printer: 'p1s' });
    expect(s1.printer).toBe('p1s');
    expect(s1.globalDefaults.zlift).not.toBe(a1Zlift);
  });
  it('addJobs parses good file and flags bad file', () => {
    const s = reducer(initialState(), {
      type: 'addJobs',
      files: [
        { name: 'bad.gcode', text: 'G28' }
      ]
    });
    expect(s.jobs[0].error).toMatch(/EXECUTABLE_BLOCK/);
  });
  it('setJobRepeats clamps to >=1', () => {
    let s = reducer(initialState(), {
      type: 'addJobs',
      files: [{ name: 'x.gcode', text: '; EXECUTABLE_BLOCK_START\nG28\n; EXECUTABLE_BLOCK_END\n' }]
    });
    const id = s.jobs[0].id;
    s = reducer(s, { type: 'setJobRepeats', id, repeats: 0 });
    expect(s.jobs[0].repeats).toBe(1);
  });
});
```

- [ ] **Step 3: Run & commit**

```bash
pnpm test
git add -A
git commit -m "feat(state): wizard reducer with printer, jobs, defaults"
```

---

### Task 10: WizardShell component

**Files:**
- Create: `src/components/WizardShell.tsx`

- [ ] **Step 1: Write WizardShell**

```tsx
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import type { Step } from '@/state';

const STEPS: { id: Step; title: string }[] = [
  { id: 'hardware', title: 'Hardware' },
  { id: 'files', title: 'Files' },
  { id: 'tune', title: 'Tune' },
  { id: 'review', title: 'Review' }
];

type Props = {
  step: Step;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  ghostAction?: { label: string; onClick: () => void; disabled?: boolean };
  advancedTrigger: React.ReactNode;
  children: React.ReactNode;
};

export function WizardShell({ step, canBack, canNext, onBack, onNext, primaryAction, ghostAction, advancedTrigger, children }: Props) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container py-4 flex items-center gap-3">
          <span className="font-semibold tracking-tight">autodruck</span>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-sm text-muted-foreground">{STEPS[idx]?.title}</span>
          <div className="flex-1" />
          <ol className="flex gap-1.5" aria-label="progress">
            {STEPS.map((s, i) => (
              <li key={s.id}
                  className={cn('h-2 w-2 rounded-full',
                    i < idx ? 'bg-primary' : i === idx ? 'bg-primary' : 'bg-muted')}
                  aria-current={i === idx ? 'step' : undefined} />
            ))}
          </ol>
          {advancedTrigger}
        </div>
      </header>

      <main className="flex-1">
        <div className="container py-8 max-w-2xl">
          {children}
        </div>
      </main>

      <footer className="border-t sticky bottom-0 bg-background">
        <div className="container py-3 flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} disabled={!canBack}>Back</Button>
          <div className="flex-1" />
          {ghostAction && (
            <Button variant="ghost" onClick={ghostAction.onClick} disabled={ghostAction.disabled}>
              {ghostAction.label}
            </Button>
          )}
          {primaryAction
            ? <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button>
            : <Button onClick={onNext} disabled={!canNext}>Next</Button>}
        </div>
      </footer>
    </div>
  );
}

export function AdvancedTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label="Advanced settings" onClick={onClick}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): wizard shell with progress dots and sticky footer"
```

---

### Task 11: Step 1 — Hardware

**Files:**
- Create: `src/steps/Step1Hardware.tsx`

- [ ] **Step 1: Write the step**

```tsx
import { PRINTERS } from '@/lib/presets';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PrinterId } from '@/lib/gcode';
import type { Stage } from '@/lib/presets';

type Props = {
  printer: PrinterId;
  stage: Stage;
  onPrinter: (p: PrinterId) => void;
  onStage: (s: Stage) => void;
};

export function Step1Hardware({ printer, stage, onPrinter, onStage }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-medium mb-3">Printer</h2>
        <div className="grid grid-cols-3 gap-2">
          {PRINTERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPrinter(p.id)}
              className={cn(
                'text-left p-4 rounded-md border transition-colors',
                printer === p.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground">
                {p.buildVolume.join(' × ')} mm
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Stage</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { s: 1 as Stage, title: 'Stage 1', sub: 'manual ramp — head sweeps part off plate' },
            { s: 2 as Stage, title: 'Stage 2', sub: 'powered actuator — servo or solenoid kick' }
          ].map(({ s, title, sub }) => (
            <button
              key={s}
              onClick={() => onStage(s)}
              className={cn(
                'text-left p-4 rounded-md border transition-colors',
                stage === s ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
              )}
            >
              <div className="font-medium">{title}</div>
              <div className="text-xs text-muted-foreground">{sub}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit (component-only, wired into App later)**

```bash
git add -A
git commit -m "feat(ui): step 1 printer and stage picker"
```

---

### Task 12: Step 2 — Files (DropZone + JobRow)

**Files:**
- Create: `src/components/DropZone.tsx`, `src/components/JobRow.tsx`, `src/steps/Step2Files.tsx`

- [ ] **Step 1: `DropZone.tsx`**

```tsx
import { useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  onFiles: (files: { name: string; text: string }[]) => void;
};

export function DropZone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function readAll(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().endsWith('.gcode'));
    const out = await Promise.all(arr.map(async (f) => ({ name: f.name, text: await f.text() })));
    if (out.length) onFiles(out);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void readAll(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-md p-12 text-center cursor-pointer transition-colors',
        over ? 'border-primary bg-accent' : 'border-border hover:bg-accent/30'
      )}
    >
      <p className="font-medium">Drop sliced .gcode here</p>
      <p className="text-sm text-muted-foreground mt-1">
        or click to pick — Bambu Studio / Orca exports work
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".gcode"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void readAll(e.target.files)}
      />
    </div>
  );
}
```

- [ ] **Step 2: `JobRow.tsx`**

```tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatDuration, parseDurationStr, type PrinterId } from '@/lib/gcode';
import type { Job } from '@/state';

type Props = {
  job: Job;
  selectedPrinter: PrinterId;
  onRemove: () => void;
};

export function JobRow({ job, selectedPrinter, onRemove }: Props) {
  const mismatched = job.detectedPrinter && job.detectedPrinter !== selectedPrinter;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{job.fileName}</span>
            {job.detectedPrinter && (
              <Badge variant={mismatched ? 'destructive' : 'secondary'}>
                {job.detectedPrinter}
              </Badge>
            )}
            {job.alreadyProcessed && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                already processed
              </Badge>
            )}
          </div>
          {job.metrics && (
            <div className="text-sm text-muted-foreground mt-1">
              {formatDuration(parseDurationStr(job.metrics.totalTime))} ·{' '}
              {job.metrics.filamentWeightG.toFixed(1)}g filament
            </div>
          )}
          {job.error && (
            <div className="text-sm text-destructive mt-2">{job.error}</div>
          )}
          {mismatched && !job.error && (
            <div className="text-sm text-yellow-700 mt-2">
              Sliced for {job.detectedPrinter} but you picked {selectedPrinter}.
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: `Step2Files.tsx`**

```tsx
import { DropZone } from '@/components/DropZone';
import { JobRow } from '@/components/JobRow';
import type { Job } from '@/state';
import type { PrinterId } from '@/lib/gcode';

type Props = {
  jobs: Job[];
  printer: PrinterId;
  onAdd: (files: { name: string; text: string }[]) => void;
  onRemove: (id: string) => void;
};

export function Step2Files({ jobs, printer, onAdd, onRemove }: Props) {
  return (
    <div className="space-y-6">
      <DropZone onFiles={onAdd} />
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((j) => (
            <JobRow key={j.id} job={j} selectedPrinter={printer} onRemove={() => onRemove(j.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): step 2 drop zone and job list"
```

---

### Task 13: Step 3 — Tune + AdvancedSheet

**Files:**
- Create: `src/components/AdvancedSheet.tsx`, `src/steps/Step3Tune.tsx`

- [ ] **Step 1: `AdvancedSheet.tsx`**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { presetFor, type Stage, type CostSettings } from '@/lib/presets';
import type { TuningParams, PrinterId } from '@/lib/gcode';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  printer: PrinterId;
  stage: Stage;
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
  cost: CostSettings;
  onTuningPatch: (patch: Partial<TuningParams>) => void;
  onTemplatesPatch: (t: { pre?: string; post?: string } | null) => void;
  onCostPatch: (patch: Partial<CostSettings>) => void;
};

const TUNING_FIELDS: Array<{ key: keyof TuningParams; label: string; unit?: string }> = [
  { key: 'cooldownTarget', label: 'Cooldown target', unit: '°C' },
  { key: 'cooldownOvershoot', label: 'Cooldown overshoot', unit: '°C' },
  { key: 'dwell', label: 'Dwell after cooldown', unit: 's' },
  { key: 'nozzleTempIdle', label: 'Nozzle idle temp', unit: '°C' },
  { key: 'bedTempReheat', label: 'Bed reheat (0 = off)', unit: '°C' },
  { key: 'zlift', label: 'Z lift', unit: 'mm' },
  { key: 'repeats', label: 'Sweep repeats' },
  { key: 'pushx', label: 'Push X', unit: 'mm' },
  { key: 'returnx', label: 'Return X', unit: 'mm' },
  { key: 'pushspeed', label: 'Push speed', unit: 'mm/min' },
  { key: 'returnspeed', label: 'Return speed', unit: 'mm/min' },
  { key: 'parky', label: 'Park Y', unit: 'mm' },
  { key: 'parkz', label: 'Park Z', unit: 'mm' }
];

const COST_FIELDS: Array<{ key: keyof CostSettings; label: string; unit?: string }> = [
  { key: 'filamentPerKg', label: 'Filament price', unit: '€/kg' },
  { key: 'electricityPerKwh', label: 'Electricity', unit: '€/kWh' },
  { key: 'printerWatts', label: 'Printer draw', unit: 'W' },
  { key: 'laborPerHour', label: 'Labor', unit: '€/h' },
  { key: 'laborMinutesPerPrint', label: 'Labor per print', unit: 'min' },
  { key: 'depreciationPerHour', label: 'Depreciation', unit: '€/h' },
  { key: 'failureRatePct', label: 'Failure rate', unit: '%' }
];

export function AdvancedSheet(p: Props) {
  const preset = presetFor(p.printer, p.stage);
  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Advanced</SheetTitle></SheetHeader>
        <Tabs defaultValue="tuning" className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="tuning">Tuning</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="cost">Cost</TabsTrigger>
          </TabsList>

          <TabsContent value="tuning" className="space-y-3 mt-4">
            {TUNING_FIELDS.map(({ key, label, unit }) => (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Label htmlFor={`t-${key}`}>{label}{unit && <span className="text-muted-foreground"> ({unit})</span>}</Label>
                <Input
                  id={`t-${key}`}
                  type="number"
                  className="w-24"
                  value={String(p.globalDefaults[key] ?? 0)}
                  onChange={(e) => p.onTuningPatch({ [key]: Number(e.target.value) } as Partial<TuningParams>)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            <div>
              <Label>Pre-print gcode</Label>
              <Textarea
                rows={4}
                value={p.customTemplates?.pre ?? preset.pre}
                onChange={(e) => p.onTemplatesPatch({ ...p.customTemplates, pre: e.target.value })}
              />
            </div>
            <div>
              <Label>Post-print gcode</Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={p.customTemplates?.post ?? preset.post}
                onChange={(e) => p.onTemplatesPatch({ ...p.customTemplates, post: e.target.value })}
              />
            </div>
            <Button variant="ghost" onClick={() => p.onTemplatesPatch(null)}>Reset to preset</Button>
          </TabsContent>

          <TabsContent value="cost" className="space-y-3 mt-4">
            {COST_FIELDS.map(({ key, label, unit }) => (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Label htmlFor={`c-${key}`}>{label}{unit && <span className="text-muted-foreground"> ({unit})</span>}</Label>
                <Input
                  id={`c-${key}`}
                  type="number"
                  className="w-24"
                  value={String(p.cost[key])}
                  onChange={(e) => p.onCostPatch({ [key]: Number(e.target.value) } as Partial<CostSettings>)}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: `Step3Tune.tsx`**

```tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { presetLabel } from '@/lib/presets';
import type { Job } from '@/state';
import type { PrinterId, TuningParams } from '@/lib/gcode';
import type { Stage } from '@/lib/presets';
import { ChevronDown } from 'lucide-react';

type Props = {
  printer: PrinterId;
  stage: Stage;
  jobs: Job[];
  globalDefaults: TuningParams;
  onJobRepeats: (id: string, n: number) => void;
  onOpenAdvanced: () => void;
};

export function Step3Tune({ printer, stage, jobs, globalDefaults, onJobRepeats, onOpenAdvanced }: Props) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{presetLabel(printer, stage)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Cooldown {globalDefaults.cooldownTarget}°C · {globalDefaults.repeats} sweeps · {globalDefaults.zlift}mm zlift · dwell {globalDefaults.dwell}s
            </div>
          </div>
          <Button variant="ghost" onClick={onOpenAdvanced}>Edit defaults</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {jobs.map((job) => (
          <Collapsible key={job.id}>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 truncate font-medium">{job.fileName}</div>
                <label className="flex items-center gap-2 text-sm">
                  Loops
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={job.repeats}
                    onChange={(e) => onJobRepeats(job.id, parseInt(e.target.value, 10) || 1)}
                  />
                </label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Override">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-3 text-sm text-muted-foreground">
                Per-job overrides land in v2 — use the global advanced sheet for now.
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
```

(Per-job override forms are deferred to keep this task tight; the data path in state already supports `overrides`.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): step 3 tune view and advanced sheet"
```

---

### Task 14: Step 4 — Review (StatStrip + Sparkline + download)

**Files:**
- Create: `src/components/Sparkline.tsx`, `src/components/StatStrip.tsx`, `src/steps/Step4Review.tsx`

- [ ] **Step 1: `Sparkline.tsx`**

```tsx
import { sparklinePath } from '@/lib/tufte';

export function Sparkline({ values, width = 120, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null;
  const { d } = sparklinePath(values, { width, height, pad: 2 });
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}
```

(Style guidance: read the `tufte` skill for axis-free, ink-minimal sparklines. No ticks, no axes, no labels inside the SVG.)

- [ ] **Step 2: `StatStrip.tsx`**

```tsx
import { Sparkline } from './Sparkline';

export function StatStrip({ items }: { items: { label: string; value: string; series: number[] }[] }) {
  return (
    <div className="grid grid-cols-3 gap-6 border-y py-4">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</div>
          <div className="text-2xl font-medium mt-0.5">{it.value}</div>
          <div className="text-muted-foreground mt-1"><Sparkline values={it.series} /></div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Download helpers in `src/lib/output.ts`**

```ts
import { downloadZip } from 'client-zip';
import { presetFor, type Stage } from './presets';
import {
  buildMergedHeader,
  extractExecutableBody,
  injectGcode,
  stripLeadingLimits,
  substitute,
  parseHeaderMetrics,
  type PrinterId,
  type TuningParams
} from './gcode';
import { md5 } from './md5';
import type { Job } from '@/state';

type BuildOpts = {
  printer: PrinterId;
  stage: Stage;
  globalDefaults: TuningParams;
  customTemplates: { pre?: string; post?: string } | null;
};

export function buildSingle(job: Job, opts: BuildOpts): string {
  const preset = presetFor(opts.printer, opts.stage);
  const params: TuningParams = { ...opts.globalDefaults, ...job.overrides };
  const pre = substitute(opts.customTemplates?.pre ?? preset.pre, params);
  const post = substitute(opts.customTemplates?.post ?? preset.post, params);
  return injectGcode(job.rawGcode, { pre, post });
}

export function buildMerged(jobs: Job[], opts: BuildOpts): string {
  const processed = jobs.map((j) => ({ job: j, gcode: buildSingle(j, opts) }));
  const metricsList = processed.map(({ job }) => ({
    m: parseHeaderMetrics(job.rawGcode)!,
    n: job.repeats
  }));
  const header = buildMergedHeader(metricsList, processed.map(({ job }) => job.fileName));
  const bodies: string[] = [];
  processed.forEach(({ gcode }, i) => {
    let body = extractExecutableBody(gcode);
    if (i > 0) body = stripLeadingLimits(body);
    bodies.push(body);
  });
  return [
    header,
    '; EXECUTABLE_BLOCK_START',
    bodies.join('\n'),
    '; EXECUTABLE_BLOCK_END',
    ''
  ].join('\n');
}

export function downloadBlob(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function mergedFilename(printer: PrinterId, stage: Stage, n: number, body: string) {
  return `autodruck_${printer}_s${stage}_${n}jobs_${md5(body).slice(0, 8)}.gcode`;
}

export async function downloadEach(jobs: Job[], opts: BuildOpts) {
  const files = jobs.map((j) => ({
    name: j.fileName.replace(/\.gcode$/i, '__autodruck.gcode'),
    input: buildSingle(j, opts)
  }));
  const blob = await downloadZip(files).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'autodruck_jobs.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

Install `client-zip`:

```bash
pnpm add client-zip
```

- [ ] **Step 4: `Step4Review.tsx`**

```tsx
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { StatStrip } from '@/components/StatStrip';
import { computeCost } from '@/lib/cost';
import { formatDuration, parseDurationStr } from '@/lib/gcode';
import type { Job } from '@/state';
import type { CostSettings } from '@/lib/presets';

type Props = {
  jobs: Job[];
  cost: CostSettings;
  mismatchedCount: number;
};

export function Step4Review({ jobs, cost, mismatchedCount }: Props) {
  const validJobs = jobs.filter((j) => j.metrics && !j.error);
  const breakdowns = validJobs.map((j) => ({ job: j, c: computeCost(j.metrics!, cost, j.repeats) }));
  const totals = breakdowns.reduce(
    (a, { c }) => ({
      filament: a.filament + c.filament,
      electricity: a.electricity + c.electricity,
      labor: a.labor + c.labor,
      depreciation: a.depreciation + c.depreciation,
      failureAdjustment: a.failureAdjustment + c.failureAdjustment,
      total: a.total + c.total
    }),
    { filament: 0, electricity: 0, labor: 0, depreciation: 0, failureAdjustment: 0, total: 0 }
  );
  const totalSeconds = validJobs.reduce((a, j) => a + parseDurationStr(j.metrics!.totalTime) * j.repeats, 0);
  const totalGrams = validJobs.reduce((a, j) => a + j.metrics!.filamentWeightG * j.repeats, 0);

  return (
    <div className="space-y-6">
      {mismatchedCount > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {mismatchedCount} file(s) were sliced for a different printer. Merge is disabled — remove them, or use "Download each" to keep them as standalone files.
        </div>
      )}

      <StatStrip items={[
        { label: 'Time',     value: formatDuration(totalSeconds),   series: validJobs.map((j) => parseDurationStr(j.metrics!.totalTime) * j.repeats) },
        { label: 'Filament', value: totalGrams.toFixed(0) + ' g',   series: validJobs.map((j) => j.metrics!.filamentWeightG * j.repeats) },
        { label: 'Cost',     value: '€ ' + totals.total.toFixed(2), series: breakdowns.map((b) => b.c.total) }
      ]} />

      <Card className="p-2">
        <Table>
          <TableBody>
            <TableRow><TableCell>Filament</TableCell><TableCell className="text-right">€ {totals.filament.toFixed(2)}</TableCell></TableRow>
            <TableRow><TableCell>Electricity</TableCell><TableCell className="text-right">€ {totals.electricity.toFixed(2)}</TableCell></TableRow>
            <TableRow><TableCell>Labor</TableCell><TableCell className="text-right">€ {totals.labor.toFixed(2)}</TableCell></TableRow>
            <TableRow><TableCell>Depreciation</TableCell><TableCell className="text-right">€ {totals.depreciation.toFixed(2)}</TableCell></TableRow>
            <TableRow><TableCell>Failure adjustment</TableCell><TableCell className="text-right">€ {totals.failureAdjustment.toFixed(2)}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Total</TableCell><TableCell className="text-right font-medium">€ {totals.total.toFixed(2)}</TableCell></TableRow>
          </TableBody>
        </Table>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2">Per-job</h3>
        <Table>
          <TableBody>
            {breakdowns.map(({ job, c }) => (
              <TableRow key={job.id}>
                <TableCell className="truncate max-w-[20rem]">{job.fileName} × {job.repeats}</TableCell>
                <TableCell>{formatDuration(parseDurationStr(job.metrics!.totalTime) * job.repeats)}</TableCell>
                <TableCell className="text-right">€ {c.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): step 4 review with cost breakdown and tufte sparklines"
```

---

### Task 15: Wire `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Write App with reducer + persistence + step routing**

```tsx
import { useEffect, useReducer, useState } from 'react';
import { WizardShell, AdvancedTrigger } from '@/components/WizardShell';
import { Step1Hardware } from '@/steps/Step1Hardware';
import { Step2Files } from '@/steps/Step2Files';
import { Step3Tune } from '@/steps/Step3Tune';
import { Step4Review } from '@/steps/Step4Review';
import { AdvancedSheet } from '@/components/AdvancedSheet';
import { Toaster, toast } from 'sonner';
import { reducer, initialState, type Step } from '@/state';
import { loadPersisted, savePersisted } from '@/lib/store';
import {
  buildMerged, buildSingle, downloadBlob, downloadEach, mergedFilename
} from '@/lib/output';

const STEP_ORDER: Step[] = ['hardware', 'files', 'tune', 'review'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = loadPersisted();
    dispatch({ type: 'hydrate', partial: {
      printer: (p.printer as any) ?? state.printer,
      stage: (p.stage as any) ?? state.stage,
      globalDefaults: (p.globalDefaults as any) ?? state.globalDefaults,
      customTemplates: (p.customTemplates as any) ?? state.customTemplates,
      cost: (p.cost as any) ?? state.cost
    }});
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => savePersisted({
      printer: state.printer,
      stage: state.stage,
      globalDefaults: state.globalDefaults,
      customTemplates: state.customTemplates,
      cost: state.cost
    }), 300);
    return () => clearTimeout(t);
  }, [hydrated, state.printer, state.stage, state.globalDefaults, state.customTemplates, state.cost]);

  const stepIdx = STEP_ORDER.indexOf(state.step);
  const canBack = stepIdx > 0;
  const validJobs = state.jobs.filter((j) => !j.error);
  const canNext =
    (state.step === 'hardware') ||
    (state.step === 'files' && validJobs.length > 0) ||
    (state.step === 'tune');
  const mismatched = state.jobs.filter(
    (j) => j.detectedPrinter && j.detectedPrinter !== state.printer && !j.error
  ).length;

  function handleNext() { if (stepIdx < STEP_ORDER.length - 1) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx + 1] }); }
  function handleBack() { if (stepIdx > 0) dispatch({ type: 'goto', step: STEP_ORDER[stepIdx - 1] }); }

  function handleMerge() {
    try {
      const merged = buildMerged(validJobs, state);
      const name = mergedFilename(state.printer, state.stage, validJobs.length, merged);
      downloadBlob(name, merged);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleEach() {
    try { await downloadEach(validJobs, state); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <WizardShell
        step={state.step}
        canBack={canBack}
        canNext={canNext}
        onBack={handleBack}
        onNext={handleNext}
        primaryAction={state.step === 'review'
          ? { label: `Download merged ↵`, onClick: handleMerge, disabled: mismatched > 0 || validJobs.length === 0 }
          : undefined}
        ghostAction={state.step === 'review'
          ? { label: 'Download each', onClick: () => void handleEach(), disabled: validJobs.length === 0 }
          : undefined}
        advancedTrigger={<AdvancedTrigger onClick={() => dispatch({ type: 'toggleAdvanced', open: true })} />}
      >
        {state.step === 'hardware' && (
          <Step1Hardware
            printer={state.printer} stage={state.stage}
            onPrinter={(p) => dispatch({ type: 'setPrinter', printer: p })}
            onStage={(s) => dispatch({ type: 'setStage', stage: s })}
          />
        )}
        {state.step === 'files' && (
          <Step2Files
            jobs={state.jobs} printer={state.printer}
            onAdd={(files) => dispatch({ type: 'addJobs', files })}
            onRemove={(id) => dispatch({ type: 'removeJob', id })}
          />
        )}
        {state.step === 'tune' && (
          <Step3Tune
            printer={state.printer} stage={state.stage}
            jobs={state.jobs} globalDefaults={state.globalDefaults}
            onJobRepeats={(id, n) => dispatch({ type: 'setJobRepeats', id, repeats: n })}
            onOpenAdvanced={() => dispatch({ type: 'toggleAdvanced', open: true })}
          />
        )}
        {state.step === 'review' && (
          <Step4Review jobs={state.jobs} cost={state.cost} mismatchedCount={mismatched} />
        )}
      </WizardShell>

      <AdvancedSheet
        open={state.advancedOpen}
        onOpenChange={(v) => dispatch({ type: 'toggleAdvanced', open: v })}
        printer={state.printer} stage={state.stage}
        globalDefaults={state.globalDefaults}
        customTemplates={state.customTemplates}
        cost={state.cost}
        onTuningPatch={(patch) => dispatch({ type: 'setGlobalDefault', patch })}
        onTemplatesPatch={(templates) => dispatch({ type: 'setCustomTemplates', templates })}
        onCostPatch={(patch) => dispatch({ type: 'setCost', patch })}
      />

      <Toaster richColors position="bottom-right" />
    </>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
pnpm typecheck
pnpm test
pnpm dev --port 5173 &
sleep 2
echo "open http://localhost:5173 in a browser to smoke-test"
```

Walk through: pick A1 → drop `src/test/fixtures/a1_stage1.gcode` → next → set Loops to 2 → next → see stats → click `Download merged ↵`. Confirm the file downloads and contains both `EXECUTABLE_BLOCK_START` and `farm portal · stage 1 detachment` and `; HEADER_BLOCK_START`. Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire wizard, persistence, and download actions"
```

---

### Task 16: Playwright e2e smoke + CI

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`
- Modify: `package.json` (add `e2e` script)

- [ ] **Step 1: Install Playwright**

```bash
cd ~/autodruck
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: `e2e/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4173', headless: true },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
```

- [ ] **Step 3: `e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test('full wizard: pick A1, drop fixture, merge, download', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const fixture = path.resolve('src/test/fixtures/a1_stage1.gcode');
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('a1_stage1.gcode')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download merged/ }).click()
  ]);

  const tmp = await download.path();
  expect(tmp).toBeTruthy();
  const body = fs.readFileSync(tmp!, 'utf8');
  expect(body).toContain('EXECUTABLE_BLOCK_START');
  expect(body).toMatch(/farm portal · stage 1 detachment/);
});
```

- [ ] **Step 4: Add `e2e` script to `package.json`**

```json
"e2e": "playwright test --config=e2e/playwright.config.ts"
```

Also add `"build:strict": "pnpm typecheck && pnpm build"` for CI convenience (optional).

- [ ] **Step 5: Run e2e locally**

```bash
pnpm build
pnpm e2e
```

Expected: 1 passing.

- [ ] **Step 6: CI workflow `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: playwright smoke and ci workflow"
```

---

### Task 17: LICENSE + README

**Files:**
- Create: `LICENSE`
- Overwrite: `README.md`

- [ ] **Step 1: Drop GPL-3.0 plaintext into `LICENSE`**

Use the canonical GPL-3.0 license text from `https://www.gnu.org/licenses/gpl-3.0.txt`. The implementer should fetch it once and commit verbatim. Header:

```
                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

  [... full GPL-3.0 text ...]
```

- [ ] **Step 2: Write `README.md`**

```markdown
# autodruck — open-source 3D printer farm automation

Browser-based G-code post-processor for unattended back-to-back printing on Bambu Lab printers. Take any sliced `.gcode` from Bambu Studio or OrcaSlicer, inject a plate-detach and cleaning routine, and loop your prints overnight. Compatible with [Farmloop](https://github.com/Maxime-Belleville/FarmLoop) stage-1 mechanical detach hardware and 3D-printable parts.

**No accounts. No cloud. No telemetry.** Everything runs in your browser.

## Supported printers

Bambu Lab **A1**, **A1 mini**, **P1S**, **P1P**, **P2S**, **X1 Carbon**, **H2S**, **H2D**, **H2C**.

## What it does

- **Plate detachment gcode injection** — adds a cooldown + head-sweep (Stage 1) or powered actuator (Stage 2) routine to the end of your sliced file.
- **Print looping / job queuing** — concatenate multiple sliced files (or repeats of the same file) into one continuous farm-print gcode.
- **Per-printer presets** — tuned geometry, sweep speeds, cooldown targets for each Bambu model out of the box.
- **Cost model** — filament, electricity, labor, depreciation, and failure-rate adjusted total cost per job.
- **Tufte-style charts** — minimal sparklines for time / filament / cost across queued jobs.

## How it works

```
Bambu Studio / OrcaSlicer
    │
    ▼   .gcode
┌────────────┐     pick printer + stage
│ autodruck  │ ─── drop files ───────────►  inject + (optionally) merge
└────────────┘
    │
    ▼   <printer>_s<stage>_<N>jobs.gcode
        send to printer via SD / LAN
```

## Quickstart (use the live tool)

1. Open the deployed app (or clone and run locally — see Build).
2. Pick your printer and the Farmloop hardware stage you have installed.
3. Drop one or more sliced `.gcode` files. Each one keeps its own loop count.
4. Tune temps, sweep geometry, and loop counts if needed.
5. Download the merged farm-print `.gcode`, drop it onto the SD card, run it.

## Hardware

Designed to drive [Farmloop](https://github.com/Maxime-Belleville/FarmLoop) stage-1 hardware — a passive ramp + 3D-printed plate-clip parts that turn a single Bambu printer into an unattended farm node. Stage-2 support is for powered actuator setups (servo / solenoid kick).

The Farmloop project lists supported hardware and prints the parts you need. autodruck is the software side: it just emits the right gcode to drive that hardware.

## Privacy

The app runs **entirely in your browser**. Your gcode files are never uploaded anywhere. Settings persist to `localStorage` on your machine. No analytics, no fonts loaded from CDNs.

## Build

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # → dist/
pnpm preview      # serve dist/ for a final check
```

Self-host the `dist/` folder anywhere — GitHub Pages, Cloudflare Pages, a USB stick, your own server. It's fully static.

## Tests

```bash
pnpm test         # vitest — gcode parse / inject / merge / cost
pnpm e2e          # playwright — full wizard smoke
```

## License

GPL-3.0. See `LICENSE`.

## Roadmap

- `.3mf` import (unzip + parse embedded plate gcode)
- Dark mode
- Web Worker offload for >50MB gcode
- OctoPrint / Bambu Connect upload from the review screen
- Print queue scheduler across multiple printers

## Keywords

3D printer farm · open source 3D printing · unattended printing · automatic part ejection · Bambu Lab automation · Farmloop · gcode post-processor · plate cleaning · print loop · A1 farm · P1S farm · X1C farm · H2D farm · home print farm · self-hosted print farm
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: GPL-3.0 license and keyword-heavy README"
```

---

### Task 18: Remove legacy files

**Files:**
- Delete: `legacy-index.html`, `legacy-main.js`, `legacy-styles.css`, `lib/` (the entire old directory), `.claude/launch.json` (if it referenced legacy paths — read first)

- [ ] **Step 1: Confirm parity manually**

```bash
cd ~/autodruck
pnpm dev --port 5173 &
sleep 2
echo "Sanity check: open http://localhost:5173, drop legacy gcode samples, confirm output matches what the legacy app produced. Then kill the server."
# kill %1 when done
```

If anything is missing, address it as a follow-up commit before deleting.

- [ ] **Step 2: Remove legacy files**

```bash
cd ~/autodruck
rm -f legacy-index.html legacy-main.js legacy-styles.css
rm -rf lib
```

(Leave `.claude/launch.json` alone unless it references deleted paths; read it first.)

- [ ] **Step 3: Re-run full suite**

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

All green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: drop legacy vanilla js implementation"
```

---

## Self-review

1. **Spec coverage:**
   - ✅ Vite+React+TS+shadcn — Tasks 1, 2
   - ✅ pnpm — Task 1
   - ✅ Single-page wizard with 4 steps — Tasks 10-14
   - ✅ Reducer-based state — Task 9
   - ✅ TS port of lib — Tasks 4-8
   - ✅ Tests (Vitest + Playwright) — Tasks 3, 5, 6, 7, 9, 16
   - ✅ CI workflow — Task 16
   - ✅ Filename convention — Task 14
   - ✅ Mixed-printer merge blocked — Task 15 (`mismatched`)
   - ✅ Already-processed warning — Task 12 (`JobRow`)
   - ✅ Parse failures shown with red banner — Task 12
   - ✅ localStorage persistence excluding jobs — Task 15
   - ✅ AdvancedSheet 3 tabs — Task 13
   - ✅ Cost breakdown table + sparklines via tufte skill — Task 14
   - ✅ "Download each" zip — Task 14 (`client-zip`)
   - ✅ LICENSE GPL-3.0 + keyword-heavy README — Task 17
   - ✅ No `Claude` in commits — header
   - ✅ Legacy files removed last — Task 18

2. **Placeholder scan:** No TBDs. Each step shows actual code. The two intentional deferrals (`.3mf`, per-job override form, Web Worker offload) are explicitly listed in the README roadmap and the spec out-of-scope section, not hidden as TODOs in the plan.

3. **Type consistency:** `PrinterId` defined in `gcode.ts` and reused everywhere. `Stage = 1 | 2` defined in `presets.ts`, reused. `TuningParams` defined in `gcode.ts`, consumed by reducer + `AdvancedSheet`. `CostSettings` defined in `presets.ts`, consumed by `cost.ts` + state + sheet. `Job` defined in `state.ts`, consumed by all steps. No conflicts.

4. **Ambiguity check:**
   - `parseFile`'s "Missing EXECUTABLE_BLOCK markers" message phrasing is fixed in the reducer — tests can assert against it directly.
   - The `customTemplates` field is `{ pre?, post? } | null` and `AdvancedSheet` falls back to `presetFor(...)` defaults — explicit in both Task 13 and Task 14's `buildSingle`.

Plan ready.
