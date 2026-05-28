import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSingle, buildMerged, mergedFilename } from '@/lib/output';
import { parseHeaderMetrics } from '@/lib/gcode';
import type { Job } from '@/state';

const fx = (name: string) =>
  readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');

function makeJob(fileName: string, rawGcode: string, overrides: Partial<Job> = {}): Job {
  return {
    id: 'test-' + fileName,
    fileName,
    rawGcode,
    detectedPrinter: null,
    metrics: parseHeaderMetrics(rawGcode),
    alreadyProcessed: false,
    repeats: 1,
    overrides: {},
    error: null,
    ...overrides
  };
}

const A1_GCODE = fx('a1_stage1.gcode');
const P1S_GCODE = fx('p1s_stage2.gcode');

const BASE_OPTS = {
  printer: 'a1' as const,
  globalDefaults: {
    cooldownTarget: 25,
    cooldownOvershoot: 5,
    dwell: 20,
    bedTempReheat: 0,
    nozzleTempIdle: 140,
    zlift: 8,
    repeats: 3,
    pushx: -18,
    returnx: 120,
    pushspeed: 6000,
    returnspeed: 12000,
    parky: 240,
    parkz: 100
  },
  customTemplates: null
};

describe('buildSingle', () => {
  it('injects pre + post for a1_stage1 fixture', () => {
    const job = makeJob('a1_stage1.gcode', A1_GCODE);
    const out = buildSingle(job, BASE_OPTS);
    expect(out).toMatch(/farm portal · stage 1 detachment/);
  });
});

describe('buildMerged', () => {
  it('produces output with one HEADER_BLOCK and one EXECUTABLE_BLOCK_START', () => {
    const job1 = makeJob('a1_stage1.gcode', A1_GCODE);
    const job2 = makeJob('p1s_stage2.gcode', P1S_GCODE);
    const out = buildMerged([job1, job2], BASE_OPTS);
    const headerCount = (out.match(/HEADER_BLOCK_START/g) ?? []).length;
    const execCount = (out.match(/EXECUTABLE_BLOCK_START/g) ?? []).length;
    expect(headerCount).toBe(1);
    expect(execCount).toBe(1);
  });

  it('includes both source filenames in the merged header', () => {
    const job1 = makeJob('a1_stage1.gcode', A1_GCODE);
    const job2 = makeJob('p1s_stage2.gcode', P1S_GCODE);
    const out = buildMerged([job1, job2], BASE_OPTS);
    expect(out).toContain('; source: a1_stage1.gcode');
    expect(out).toContain('; source: p1s_stage2.gcode');
  });

  it('strips leading limits from the second job body', () => {
    // Use empty custom templates so the executable body starts directly with M-codes,
    // making stripLeadingLimits effective. p1s_stage2 leads with M73/M201/M203/M204/M205.
    const optsNoTemplate = { ...BASE_OPTS, customTemplates: { pre: '', post: '' } };
    const job1 = makeJob('a1_stage1.gcode', A1_GCODE);
    const job2 = makeJob('p1s_stage2.gcode', P1S_GCODE);
    const out = buildMerged([job1, job2], optsNoTemplate);
    // M203 only appears in p1s_stage2 leading block — stripped from job2, absent in output
    const m203count = (out.match(/^M203 /gm) ?? []).length;
    expect(m203count).toBe(0);
  });
});

describe('mergedFilename', () => {
  it('returns the spec pattern autodruck_<printer>_<N>jobs_<8hex>.gcode', () => {
    const body = 'some gcode content';
    const name = mergedFilename('a1', 2, body);
    expect(name).toMatch(/^autodruck_a1_2jobs_[0-9a-f]{8}\.gcode$/);
  });
});
