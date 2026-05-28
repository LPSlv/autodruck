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
