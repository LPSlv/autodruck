# autodruck: open-source 3D printer farm automation

Browser-based G-code post-processor for unattended back-to-back printing on Bambu Lab printers. Take any sliced `.gcode` from Bambu Studio or OrcaSlicer, inject a plate-detach and cleaning routine, and loop your prints overnight. Compatible with [Farmloop](https://github.com/Maxime-Belleville/FarmLoop) mechanical detach hardware and 3D-printable parts.

**No accounts. No cloud. No telemetry.** Everything runs in your browser.

## Supported printers

Bambu Lab **A1**, **A1 mini**, **P1S**, **P1P**, **P2S**, **X1 Carbon**, **H2S**, **H2D**, **H2C**.

## What it does

- **Plate detachment gcode injection**: adds a cooldown and head-sweep routine to the end of your sliced file.
- **Print looping and job queuing**: concatenate multiple sliced files (or repeats of the same file) into one continuous farm-print gcode.
- **Per-printer presets**: tuned geometry, sweep speeds, and cooldown targets for each Bambu model out of the box.
- **Cost model**: filament, electricity, labor, depreciation, and failure-rate adjusted total cost per job.

## How it works

```
Bambu Studio / OrcaSlicer
    │
    ▼   .gcode
┌────────────┐     pick printer
│ autodruck  │ ─── drop files ───────────►  inject + (optionally) merge
└────────────┘
    │
    ▼   autodruck_<printer>_<N>jobs.gcode
        send to printer via SD / LAN
```

## Quickstart (use the live tool)

1. Clone and run locally (see Build), or self-host the build artifact.
2. Pick your Bambu printer.
3. Drop one or more sliced `.gcode` files. Each one keeps its own loop count.
4. Tune temps, sweep geometry, and loop counts if needed.
5. Download the merged farm-print `.gcode`, drop it onto the SD card, run it.

## Hardware

Designed to drive [Farmloop](https://github.com/Maxime-Belleville/FarmLoop) hardware: a passive ramp plus 3D-printed plate-clip parts that turn a single Bambu printer into an unattended farm node. autodruck emits the gcode to drive that hardware.

## Privacy

The app runs **entirely in your browser**. Your gcode files are never uploaded anywhere. Settings persist to `localStorage` on your machine. No analytics, no fonts loaded from CDNs.

## Build

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # → dist/
pnpm preview      # serve dist/ for a final check
```

Self-host the `dist/` folder anywhere: GitHub Pages, Cloudflare Pages, a USB stick, your own server. It's fully static.

## Tests

```bash
pnpm test         # vitest: gcode parse, inject, merge, cost
pnpm e2e          # playwright: full wizard smoke
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
