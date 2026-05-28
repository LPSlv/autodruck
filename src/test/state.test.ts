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
