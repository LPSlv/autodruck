import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initialState, reducer } from '@/state';

const fx = (name: string) =>
  readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

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

describe('mismatch detection', () => {
  it('detects printer mismatch when a p1s file is added with a1 selected', () => {
    const a1Text = fx('a1_stage1.gcode');
    const p1sText = fx('p1s_stage2.gcode');
    const s = reducer(initialState(), {
      type: 'addJobs',
      files: [
        { name: 'a1_stage1.gcode', text: a1Text },
        { name: 'p1s_stage2.gcode', text: p1sText }
      ]
    });
    // initial state has printer = 'a1'
    const mismatched = s.jobs.filter(
      (j) => j.detectedPrinter && j.detectedPrinter !== 'a1'
    );
    expect(mismatched).toHaveLength(1);
    expect(mismatched[0].detectedPrinter).toBe('p1s');
  });
});
