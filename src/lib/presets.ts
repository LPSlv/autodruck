// Hardware presets + default tuning per printer. Templates are
// generic Bambu motion commands meant as a starting point — paste your
// hardware-specific gcode in the settings drawer.
import type { PrinterId, TuningParams } from './gcode';

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

export const PRINTERS: PrinterMeta[] = [
  { id: 'a1',     label: 'A1',      modelIds: ['N2S'], buildVolume: [256, 256, 256] },
  { id: 'a1mini', label: 'A1 mini', modelIds: ['N1S'], buildVolume: [180, 180, 180] },
  { id: 'p1s',    label: 'P1S',     modelIds: ['C12'], buildVolume: [256, 256, 256] },
  { id: 'p1p',    label: 'P1P',     modelIds: ['C15'], buildVolume: [256, 256, 256] },
  { id: 'p2s',    label: 'P2S',     modelIds: ['C13'], buildVolume: [256, 256, 256] },
  { id: 'x1c',    label: 'X1C',     modelIds: ['C11'], buildVolume: [256, 256, 256] },
  { id: 'h2s',    label: 'H2S',     modelIds: ['C16'], buildVolume: [350, 320, 325] },
  { id: 'h2d',    label: 'H2D',     modelIds: ['C17'], buildVolume: [350, 320, 325] },
  { id: 'h2c',    label: 'H2C',     modelIds: ['C18'], buildVolume: [350, 320, 325] }
];

const a1_post = [
  '; --- farm portal · stage 1 detachment ---',
  'M117 cooling for detach',
  'M104 S{nozzleTempIdle} ; nozzle to idle temp (low to prevent oozing)',
  'M140 S{cooldownTarget} ; bed cool target',
  'M190 R{cooldownWaitAt} ; wait until below (target minus overshoot)',
  'G4 S{dwell} ; let thermal mass equalize',
  'M140 S0 ; fully off so firmware can\'t reapply profile minimum',
  'G90',
  'G1 Z{zlift} F600',
  '{repeat:repeats}',
  'G1 X{pushx} F{pushspeed}',
  'G1 X{returnx} F{returnspeed}',
  '{endrepeat}',
  'G1 Y{parky} F3000',
  'G1 Z{parkz} F600',
  '{if:bedTempReheat}M140 S{bedTempReheat} ; warm bed for next print{endif}',
  'M84',
  'M117 ready'
].join('\n');

const a1_pre = '; --- farm portal · pre-print marker ---\nM117 starting print';

const TEMP_DEFAULTS = {
  cooldownTarget: 25,
  cooldownOvershoot: 5,
  dwell: 20,
  bedTempReheat: 0,
  nozzleTempIdle: 140
};

export const PRESETS: Record<PrinterId, Preset> = {
  a1:     { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, zlift: 8, repeats: 3, pushx: -18, returnx: 120, pushspeed: 6000, returnspeed: 12000, parky: 240, parkz: 100 } },
  a1mini: { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, zlift: 5, repeats: 3, pushx: -15, returnx: 90, pushspeed: 6000, returnspeed: 12000, parky: 170, parkz: 80 } },
  p1s:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  p1p:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  p2s:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  x1c:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  h2s:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  h2d:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
  h2c:    { pre: a1_pre, post: a1_post,
            defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } }
};

export const DEFAULT_COST: CostSettings = {
  filamentPerKg: 22,
  electricityPerKwh: 0.18,
  printerWatts: 120,
  laborPerHour: 30,
  laborMinutesPerPrint: 1.5,
  depreciationPerHour: 0.35,
  failureRatePct: 3
};

export function presetFor(printer: PrinterId): Preset {
  return PRESETS[printer] || PRESETS.a1;
}

export function presetLabel(printer: PrinterId): string {
  const p = PRINTERS.find((x) => x.id === printer);
  return p ? p.label : printer;
}
