// Hardware presets + default tuning per (printer × stage). Templates are
// generic Bambu motion commands meant as a starting point — paste your
// hardware-specific gcode in the settings drawer.

export const PRINTERS = [
  { id: "a1",     label: "A1",      modelIds: ["N2S"], buildVolume: [256, 256, 256] },
  { id: "a1mini", label: "A1 mini", modelIds: ["N1S"], buildVolume: [180, 180, 180] },
  { id: "p1s",    label: "P1S",     modelIds: ["C12"], buildVolume: [256, 256, 256] },
  { id: "p1p",    label: "P1P",     modelIds: ["C15"], buildVolume: [256, 256, 256] },
  { id: "p2s",    label: "P2S",     modelIds: ["C13"], buildVolume: [256, 256, 256] },
  { id: "x1c",    label: "X1C",     modelIds: ["C11"], buildVolume: [256, 256, 256] },
  { id: "h2s",    label: "H2S",     modelIds: ["C16"], buildVolume: [350, 320, 325] },
  { id: "h2d",    label: "H2D",     modelIds: ["C17"], buildVolume: [350, 320, 325] },
  { id: "h2c",    label: "H2C",     modelIds: ["C18"], buildVolume: [350, 320, 325] }
];

// Post-detach behavior: we wait for (cooldown - overshoot) because the bed
// rebounds ~5 °C from thermal mass after M190 R returns. Then M140 S0 to
// fully disable heating so the firmware can't reapply the filament profile's
// minimum bed temp. Then for back-to-back loop printing, the *next* job's
// own start gcode re-heats the bed to print temp — but if you want a warm-
// bed reheat to start the next print faster, set bedTempReheat > 0.

const a1_stage1_post = [
  "; --- farm portal · stage 1 detachment ---",
  "M117 cooling for detach",
  "M104 S{nozzleTempIdle} ; nozzle to idle temp (low to prevent oozing)",
  "M140 S{cooldownTarget} ; bed cool target",
  "M190 R{cooldownWaitAt} ; wait until below (target minus overshoot)",
  "G4 S{dwell} ; let thermal mass equalize",
  "M140 S0 ; fully off so firmware can't reapply profile minimum",
  "G90",
  "G1 Z{zlift} F600",
  "{repeat:repeats}",
  "G1 X{pushx} F{pushspeed}",
  "G1 X{returnx} F{returnspeed}",
  "{endrepeat}",
  "G1 Y{parky} F3000",
  "G1 Z{parkz} F600",
  "{if:bedTempReheat}M140 S{bedTempReheat} ; warm bed for next print{endif}",
  "M84",
  "M117 ready"
].join("\n");

const a1_stage1_pre = "; --- farm portal · pre-print marker ---\nM117 starting print";

const a1_stage2_post = [
  "; --- farm portal · stage 2 detachment ---",
  "M117 cooling",
  "M104 S{nozzleTempIdle}",
  "M140 S{cooldownTarget}",
  "M190 R{cooldownWaitAt}",
  "G4 S{dwell}",
  "M140 S0",
  "G90",
  "G1 Z{zlift} F600",
  "; trigger actuator + cooling fan",
  "M106 P3 S255",
  "G4 S3",
  "; sweep across to engage actuator",
  "{repeat:repeats}",
  "G1 X{pushx} F{pushspeed}",
  "G1 X{returnx} F{returnspeed}",
  "{endrepeat}",
  "M106 P3 S0",
  "G1 Y{parky} F3000",
  "G1 Z{parkz} F600",
  "{if:bedTempReheat}M140 S{bedTempReheat}{endif}",
  "M84",
  "M117 ready"
].join("\n");

// Defaults base — temperature handling is shared across all printers.
// Geometry (push/return X, park Y) varies per printer build volume.
const TEMP_DEFAULTS = {
  cooldownTarget: 25,      // user-visible bed cooldown target (°C)
  cooldownOvershoot: 5,    // how many °C below target to wait at (compensates rebound)
  dwell: 20,               // dwell after cooldown for thermal equalization (s)
  bedTempReheat: 0,        // 0 = leave bed off; >0 = warm bed for next print (faster restart)
  nozzleTempIdle: 140      // nozzle idle temp during detach (prevents oozing without burning)
};

export const PRESETS = {
  a1: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, zlift: 8, repeats: 3, pushx: -18, returnx: 120, pushspeed: 6000, returnspeed: 12000, parky: 240, parkz: 100 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 15, zlift: 8, repeats: 2, pushx: -18, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 240, parkz: 100 } }
  },
  a1mini: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, zlift: 5, repeats: 3, pushx: -15, returnx: 90, pushspeed: 6000, returnspeed: 12000, parky: 170, parkz: 80 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 15, zlift: 5, repeats: 2, pushx: -15, returnx: 180, pushspeed: 9000, returnspeed: 18000, parky: 170, parkz: 80 } }
  },
  p1s: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  p1p: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  p2s: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  x1c: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  // H-series (H2S/H2D/H2C — added in FarmLoop v2.7). Same build volume class
  // as P-series; verify model IDs against your printer's actual 3mf output
  // and adjust if needed.
  h2s: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  h2d: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  },
  h2c: {
    1: { pre: a1_stage1_pre, post: a1_stage1_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 30, zlift: 10, repeats: 3, pushx: 0, returnx: 220, pushspeed: 6000, returnspeed: 12000, parky: 220, parkz: 120 } },
    2: { pre: a1_stage1_pre, post: a1_stage2_post,
         defaults: { ...TEMP_DEFAULTS, dwell: 20, zlift: 10, repeats: 2, pushx: 0, returnx: 256, pushspeed: 9000, returnspeed: 18000, parky: 220, parkz: 120 } }
  }
};

export const DEFAULT_COST = {
  filamentPerKg: 22,
  electricityPerKwh: 0.18,
  printerWatts: 120,
  laborPerHour: 30,
  laborMinutesPerPrint: 1.5,
  depreciationPerHour: 0.35,
  failureRatePct: 3
};

export function presetFor(printer, stage) {
  return (PRESETS[printer] && PRESETS[printer][stage]) || PRESETS.a1[1];
}
export function presetLabel(printer, stage) {
  const p = PRINTERS.find((x) => x.id === printer);
  return `${p ? p.label : printer} · Stage ${stage}`;
}
