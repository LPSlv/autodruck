// Entry point: wires DOM to the store + gcode pipeline.
import {
  detectPrinter, parseHeaderMetrics, parseDurationStr, formatDuration,
  substitute, injectGcode, extractExecutableBody, stripLeadingLimits,
  buildMergedHeader, diffInjection, isAlreadyProcessed, md5
} from "./lib/gcode.js";
import { PRINTERS, presetLabel } from "./lib/presets.js";
import {
  state, subscribe, notify, activePreset, effectiveParams,
  saveTemplate, restoreTemplate, setDefaults, resetDefaults, setCost,
  setHardware, makeJob, addJob, removeJob, updateJob, toggleExpand,
  savePreset, applyPreset, deletePreset
} from "./lib/store.js";
import { estimateCost, fmtMoney } from "./lib/cost.js";
import { sparkline, dotplot } from "./lib/tufte.js";

// ─── Helpers ──────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v === false || v == null) {}
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const toast = (msg, kind = "") => {
  const host = $("#toast-host");
  const el = h("div", { class: `toast ${kind}` }); el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; }, 2200);
  setTimeout(() => el.remove(), 2500);
};

// ─── 3mf parsing ──────────────────────────────────────────────────
async function parse3mf(file) {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const plates = [];
  const paths = [];
  zip.forEach((p) => { if (/^Metadata\/plate_\d+\.gcode$/.test(p)) paths.push(p); });
  paths.sort();
  let thumbDataUrl = null;
  const thumbEntry = zip.file("Metadata/plate_1.png") || zip.file("Metadata/top_1.png");
  if (thumbEntry) {
    const buf = await thumbEntry.async("uint8array");
    const b64 = btoa(String.fromCharCode(...buf));
    thumbDataUrl = `data:image/png;base64,${b64}`;
  }
  for (const p of paths) {
    const gc = await zip.file(p).async("string");
    plates.push({ path: p, gcode: gc, metrics: parseHeaderMetrics(gc), printer: detectPrinter(gc) });
  }
  // Extract AMS / filament metadata so we can aggregate it during merge.
  const ams = await parseAmsMetadata(zip);
  return { zip, plates, thumbDataUrl, fileBuf: buf, ams };
}

// Pull filament-per-slot info out of a 3mf. Bambu stores this in:
//  - Metadata/plate_1.json (per-plate filament entries with used_g, used_m,
//    color, type, tray_info_idx, group_id)
//  - Metadata/filament_sequence.json (slot sequence for the print)
//  - Metadata/project_settings.config (full project filament arrays)
async function parseAmsMetadata(zip) {
  const out = { perPlate: [], sequence: null, slotsUsed: new Set() };

  // 1. Bambu's per-plate JSON (Metadata/plate_*.json) carries the slot list
  //    used by each plate via `filament_ids` and `filament_colors`.
  const plateJsonPaths = [];
  zip.forEach((p) => { if (/^Metadata\/plate_\d+\.json$/.test(p)) plateJsonPaths.push(p); });
  plateJsonPaths.sort();
  for (const p of plateJsonPaths) {
    try {
      const txt = await zip.file(p).async("string");
      const obj = JSON.parse(txt);
      if (obj?.filament_ids) {
        out.perPlate.push({
          path: p,
          colors: obj.filament_colors || [],
          ids: obj.filament_ids,
          filaments: [] // populated below from model_settings.config
        });
        obj.filament_ids.forEach((id) => out.slotsUsed.add(id));
      }
    } catch (e) { /* not JSON or no field */ }
  }

  // 2. Bambu stores per-plate <filament .../> entries with weight/length
  //    inside Metadata/slice_info.config (XML). These are the rich entries
  //    we need for AMS aggregation: id, type, color, tray_info_idx, used_m,
  //    used_g, group_id, volume_type. model_settings.config only carries
  //    plater metadata (no filament weights).
  const modelCfg = zip.file("Metadata/slice_info.config");
  if (modelCfg) {
    try {
      const txt = await modelCfg.async("string");
      // Split into per-plate sections so we can attach filaments to the
      // matching out.perPlate entry. Bambu's structure is
      // <plate>...<filament .../>...<filament .../>...</plate>.
      const plateRe = /<plate\b[^>]*>([\s\S]*?)<\/plate>/g;
      let plateMatch; let plateIdx = 0;
      while ((plateMatch = plateRe.exec(txt))) {
        const body = plateMatch[1];
        const filaments = [];
        const filRe = /<filament\b[^/>]*?\/>/g;
        let m;
        while ((m = filRe.exec(body))) {
          const tag = m[0];
          const get = (k) => {
            const x = new RegExp(`\\b${k}="([^"]*)"`).exec(tag);
            return x ? x[1] : null;
          };
          const slot = parseInt(get("id"), 10);
          filaments.push({
            slot,
            type: get("type"),
            color: get("color"),
            trayInfoIdx: get("tray_info_idx"),
            usedMm: (parseFloat(get("used_m")) || 0) * 1000, // file stores meters
            usedG:  parseFloat(get("used_g")) || 0,
            groupId: parseInt(get("group_id"), 10) || 0,
            volumeType: get("volume_type"),
            nozzleDiameter: parseFloat(get("nozzle_diameter")) || null
          });
          if (isFinite(slot)) out.slotsUsed.add(slot);
        }
        // Attach to existing perPlate entry if available, else push new
        if (out.perPlate[plateIdx]) out.perPlate[plateIdx].filaments = filaments;
        else out.perPlate.push({ path: `plate_${plateIdx + 1}`, filaments });
        plateIdx++;
      }
    } catch (e) { /* tolerate */ }
  }

  // 3. filament_sequence.json — usually trivial but keep for completeness
  const seq = zip.file("Metadata/filament_sequence.json");
  if (seq) {
    try { out.sequence = JSON.parse(await seq.async("string")); } catch {}
  }
  return out;
}

// gcode-only files: parse metrics from header if present
async function parseGcodeOnly(file) {
  const text = await file.text();
  return {
    zip: null,
    plates: [{ path: "main", gcode: text, metrics: parseHeaderMetrics(text), printer: detectPrinter(text) }],
    thumbDataUrl: null,
    fileBuf: null
  };
}

// ─── Ingestion ────────────────────────────────────────────────────
async function ingest(files) {
  for (const f of files) {
    const lc = f.name.toLowerCase();
    if (!lc.endsWith(".3mf") && !lc.endsWith(".gcode")) {
      toast(`skipped: ${f.name}`, "err");
      continue;
    }
    const job = makeJob(f);
    addJob(job);
    try {
      const parsed = lc.endsWith(".3mf") ? await parse3mf(f) : await parseGcodeOnly(f);
      const plate = parsed.plates[0];
      const detected = plate?.printer;
      const processed = isAlreadyProcessed(plate?.gcode || "");
      updateJob(job.id, {
        parsed, plate, metrics: plate?.metrics, detected, processed,
        status: processed ? "warn" : "ok"
      });
      if (detected && detected !== state.printer) {
        // Note mismatch but don't auto-switch — user might want a single hardware
      }
    } catch (e) {
      console.error(e);
      updateJob(job.id, { status: "err", error: e.message });
    }
  }
}

// ─── Processing ──────────────────────────────────────────────────
function makePrePost(job) {
  const preset = activePreset();
  const params = effectiveParams(job.overrides);
  return {
    pre: substitute(preset.pre, params),
    post: substitute(preset.post, params),
    params, preset
  };
}

async function processOne(job) {
  if (!job.parsed) throw new Error("file not parsed");
  const { pre, post } = makePrePost(job);
  if (job.parsed.zip) {
    // Re-open from fresh buffer so we don't mutate cached zip object
    const zip = await JSZip.loadAsync(job.parsed.fileBuf);
    zip.forEach((path) => {
      // no-op listing
    });
    const platePaths = [];
    zip.forEach((p) => { if (/^Metadata\/plate_\d+\.gcode$/.test(p)) platePaths.push(p); });
    for (const p of platePaths) {
      const orig = await zip.file(p).async("string");
      const inj = injectGcode(orig, { pre, post });
      zip.file(p, inj);
      const md5Path = p + ".md5";
      if (zip.file(md5Path)) zip.file(md5Path, md5(inj));
    }
    return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }
  // .gcode only
  const orig = await job.file.text();
  const inj = injectGcode(orig, { pre, post });
  return new Blob([inj], { type: "text/plain" });
}

async function processMerge(jobs) {
  if (!jobs.length) throw new Error("no jobs");
  const first = jobs.find((j) => j.parsed?.zip) || jobs[0];
  if (!first.parsed?.zip) throw new Error("merge needs at least one 3mf file");
  const carrier = await JSZip.loadAsync(first.parsed.fileBuf);
  const bodies = [];
  const metrics = [];
  const sources = [];
  // AMS aggregation: { slotKey -> { slot, type, color, trayInfoIdx, usedMm, usedG } }
  const amsAgg = new Map();

  for (const job of jobs) {
    if (!job.parsed) continue;
    const plate = job.plate;
    if (!plate) continue;
    const { pre, post } = makePrePost(job);
    const injected = injectGcode(plate.gcode, { pre, post });
    const body = extractExecutableBody(injected);
    for (let i = 0; i < job.loop; i++) {
      bodies.push({ body, label: `${job.name} (${i + 1}/${job.loop})` });
    }
    if (plate.metrics) metrics.push({ m: plate.metrics, n: job.loop });
    sources.push(`${job.name} ×${job.loop}`);

    // Aggregate filament usage across (slot × type × color) ─ scaled by loop
    const amsData = job.parsed.ams;
    if (amsData?.perPlate?.length) {
      for (const pp of amsData.perPlate) {
        if (!pp.filaments) continue;
        for (const f of pp.filaments) {
          const key = `${f.slot}|${f.type}|${f.color}`;
          const existing = amsAgg.get(key) || { ...f, usedMm: 0, usedG: 0 };
          existing.usedMm += (f.usedMm || 0) * job.loop;
          existing.usedG  += (f.usedG  || 0) * job.loop;
          amsAgg.set(key, existing);
        }
      }
    }
  }

  const cleaned = bodies.map((b, i) => (i > 0 ? { ...b, body: stripLeadingLimits(b.body) } : b));
  const merged = "; EXECUTABLE_BLOCK_START\n"
    + cleaned.map((b, i) => `; farm portal job ${i + 1}: ${b.label}\n${b.body.trimEnd()}`)
            .join("\n; ─── next job ───\n")
    + "\n; EXECUTABLE_BLOCK_END\n";

  const firstGc = first.plate.gcode;
  const cfgStart = firstGc.search(/(^|\n);\s*CONFIG_BLOCK_START\s*\n/);
  const cfgEndMatch = /\n;\s*CONFIG_BLOCK_END\s*\n/.exec(firstGc);
  if (cfgStart < 0 || !cfgEndMatch) throw new Error("CONFIG_BLOCK missing");
  const cfgBlock = firstGc.slice(cfgStart + 1, cfgEndMatch.index + cfgEndMatch[0].length);
  const finalGc = buildMergedHeader(metrics, sources) + "\n" + cfgBlock + "\n" + merged;

  // Strip plates other than plate_1 from carrier
  const toRemove = [];
  carrier.forEach((p) => { if (/^Metadata\/plate_\d+(\.gcode(\.md5)?|\.json|\.png|_small\.png|_no_light_\d+\.png|pick_\d+\.png|top_\d+\.png)$/.test(p) && !/plate_1[._]/.test(p) && !p.includes("plate_1.")) toRemove.push(p); });
  toRemove.forEach((p) => carrier.remove(p));
  carrier.file("Metadata/plate_1.gcode", finalGc);
  if (carrier.file("Metadata/plate_1.gcode.md5")) carrier.file("Metadata/plate_1.gcode.md5", md5(finalGc));

  // Rewrite plate_1.json with aggregated AMS filament metadata so the
  // printer LCD reflects the merged total weight per slot.
  await writeMergedPlateJson(carrier, amsAgg, first.parsed.ams);
  return carrier.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// Rewrite Metadata/plate_1.json keeping its XML structure intact but
// replacing each <filament .../> line's used_m / used_g with the aggregated
// totals. If a slot wasn't present in the carrier's original metadata, we
// append a new <filament/> line before the closing </plate>.
async function writeMergedPlateJson(zip, amsAgg, carrierAms) {
  if (!amsAgg || amsAgg.size === 0) return;
  // Filament weight/length live in slice_info.config (XML). Rewrite that.
  const entry = zip.file("Metadata/slice_info.config");
  if (!entry) return;
  let txt = await entry.async("string");

  for (const fil of amsAgg.values()) {
    const re = new RegExp(`(<filament\\b[^/>]*?\\bid="${fil.slot}"[^/>]*?)\\s*\\/>`, "i");
    const match = re.exec(txt);
    if (match) {
      let tag = match[1];
      const usedM = (fil.usedMm / 1000).toFixed(2);
      if (/\bused_m="[^"]*"/.test(tag)) tag = tag.replace(/\bused_m="[^"]*"/, `used_m="${usedM}"`);
      else tag += ` used_m="${usedM}"`;
      const usedG = fil.usedG.toFixed(2);
      if (/\bused_g="[^"]*"/.test(tag)) tag = tag.replace(/\bused_g="[^"]*"/, `used_g="${usedG}"`);
      else tag += ` used_g="${usedG}"`;
      txt = txt.replace(match[0], tag + " />");
    } else {
      // Slot not present in carrier's slice_info.config — append a new entry
      const newTag = `    <filament id="${fil.slot}" tray_info_idx="${fil.trayInfoIdx || ""}" type="${fil.type || ""}" color="${fil.color || "#FFFFFF"}" used_m="${(fil.usedMm/1000).toFixed(2)}" used_g="${fil.usedG.toFixed(2)}" />\n`;
      txt = txt.replace(/(<\/plate>)/, newTag + "$1");
    }
  }
  zip.file("Metadata/slice_info.config", txt);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 80);
}

function outputName(jobName) {
  // Prefix style matches FarmLoop's convention so files sort together in
  // file explorers and are visually distinguishable from un-processed source.
  const tag = `FP_S${state.stage}_`;
  // Avoid double-prefixing if user re-processes.
  if (/^FP_S\d_/.test(jobName)) return jobName;
  return tag + jobName;
}

// ─── Renders ──────────────────────────────────────────────────────
function renderEmpty() {
  const m = $("#main");
  m.innerHTML = "";
  m.appendChild(h("div", { class: "empty", id: "empty" },
    h("div", { class: "empty-glyph" }, "⌇ ⌇ ⌇"),
    h("div", { class: "empty-title" }, "drop sliced files here"),
    h("div", { class: "empty-sub", html: 'or press <code>⌘K</code> → "add files".  &nbsp;.3mf &amp; .gcode supported.' })
  ));
  const empty = $("#empty");
  empty.addEventListener("click", openFilePicker);
  // drag styles already wired globally
}

function renderJobsList() {
  const m = $("#main");
  m.innerHTML = "";
  const head = h("div", { class: "jobs-head" },
    h("span", {}, `${state.jobs.length} ${state.jobs.length === 1 ? "file" : "files"}`),
    h("div", { class: "jobs-head-actions" },
      h("button", { onclick: openFilePicker }, "+ add"),
      h("button", { onclick: () => { state.jobs.length = 0; state.expandedId = null; notify(); } }, "clear")
    )
  );
  const list = h("div", { class: "jobs" });
  list.appendChild(head);
  for (const job of state.jobs) {
    list.appendChild(renderJob(job));
  }
  m.appendChild(list);
}

function renderJob(job) {
  const expanded = state.expandedId === job.id;
  const m = job.metrics;
  const time = m?.totalTime || (m ? "—" : "parsing…");
  const grams = m?.filamentWeightG;
  const tags = [];
  if (job.processed) tags.push({ text: "already injected", cls: "warn" });
  if (job.detected && job.detected !== state.printer) tags.push({ text: `detected ${job.detected}`, cls: "" });
  const tagHtml = tags.map((t) => `<span class="job-tag ${t.cls}">${esc(t.text)}</span>`).join("");

  const node = h("div", { class: `job ${job.status || ""} ${expanded ? "expanded" : ""}`, dataset: { id: job.id } },
    h("div", { class: "job-row", onclick: (e) => {
      if (e.target.closest(".job-loop, .job-action")) return;
      toggleExpand(job.id);
    } },
      h("span", { class: "job-disc" }),
      h("div", { class: "job-thumb", style: job.parsed?.thumbDataUrl ? `background-image:url(${job.parsed.thumbDataUrl})` : "" }),
      h("div", { class: "job-name", html: esc(job.name) + tagHtml }),
      h("div", { class: "job-num" }, time),
      h("div", { class: "job-num" }, grams != null ? `${grams.toFixed(1)} g` : "—"),
      renderLoopControl(job),
      h("div", { class: "job-num dim" }, costInline(job)),
      h("div", { class: "job-caret" }, "›")
    ),
    h("div", { class: "job-detail" }, expanded ? renderJobDetail(job) : h("span"))
  );
  return node;
}

function renderLoopControl(job) {
  return h("div", { class: "job-loop", onclick: (e) => e.stopPropagation() },
    h("button", { onclick: () => updateJob(job.id, { loop: Math.max(1, job.loop - 1) }) }, "−"),
    h("input", {
      type: "number", min: "1", max: "999", value: String(job.loop),
      oninput: (e) => {
        const v = parseInt(e.target.value, 10);
        updateJob(job.id, { loop: isFinite(v) && v > 0 ? Math.min(999, v) : 1 });
      }
    }),
    h("button", { onclick: () => updateJob(job.id, { loop: Math.min(999, job.loop + 1) }) }, "+")
  );
}

function costInline(job) {
  if (!job.metrics) return "—";
  const c = estimateCost(job.metrics, state.cost);
  return fmtMoney(c.total * job.loop);
}

function renderJobDetail(job) {
  if (!job.parsed) return h("div", { class: "muted" }, "waiting on parse…");
  const m = job.metrics;
  const { pre, post, params, preset } = makePrePost(job);
  const original = job.plate?.gcode || "";
  const injected = original ? injectGcode(original, { pre, post }) : "";
  const diff = original ? diffInjection(original, injected) : [];

  // Per-job override controls — flat label/input/unit cells for clean alignment
  const fields = [
    ["cooldownTarget", "cooldown", "°C"], ["cooldownOvershoot", "overshoot", "°C"],
    ["dwell", "dwell", "s"], ["nozzleTempIdle", "nozzle idle", "°C"],
    ["bedTempReheat", "bed reheat", "°C"], ["repeats", "sweeps", "×"],
    ["zlift", "z lift", "mm"], ["parkz", "park Z", "mm"],
    ["pushx", "push X", "mm"], ["returnx", "return X", "mm"],
    ["pushspeed", "push spd", "mm/m"], ["returnspeed", "ret spd", "mm/m"],
    ["parky", "park Y", "mm"]
  ];

  const grid = h("div", { class: "overrides" });
  for (const [key, label, unit] of fields) {
    const val = params[key];
    const overridden = job.overrides[key] !== undefined;
    grid.appendChild(h("span", { class: "ov-label" + (overridden ? " overridden" : "") }, label));
    grid.appendChild(h("input", {
      class: "ov-input" + (overridden ? " overridden" : ""),
      type: "number", value: String(val), step: "0.1",
      oninput: (e) => {
        const v = parseFloat(e.target.value);
        if (isFinite(v)) updateJob(job.id, { overrides: { ...job.overrides, [key]: v } });
      }
    }));
    grid.appendChild(h("span", { class: "ov-unit" }, unit));
  }
  if (job.overrides && Object.keys(job.overrides).length) {
    grid.appendChild(h("button", { class: "ov-reset", onclick: () => updateJob(job.id, { overrides: {} }) }, "reset overrides"));
  }

  // Cost breakdown
  const cost = estimateCost(m, state.cost);
  const costRows = cost.breakdown.map((b) =>
    h("dt", {}, b.label).outerHTML + h("dd", {}, fmtMoney(b.value)).outerHTML
  ).join("");

  // Diff preview (limit lines for performance)
  const diffNode = h("div", { class: "diff" });
  const slice = diff.slice(0, 60);
  for (const d of slice) {
    diffNode.appendChild(h("div", { class: `diff-line ${d.type}` },
      h("div", { class: "diff-marker" }, d.type === "add" ? "+" : " "),
      h("div", { class: "diff-content" }, d.text || " ")
    ));
  }

  const warnings = [];
  if (job.processed) warnings.push("file looks already-injected · re-injecting will stack detach sequences");
  if (job.detected && job.detected !== state.printer) warnings.push(`file is sliced for ${job.detected}; current hardware is ${state.printer}`);

  return h("div", { class: "job-detail-grid" },
    h("div", { class: "job-detail-side" },
      h("div", { class: "job-detail-thumb-big", style: job.parsed.thumbDataUrl ? `background-image:url(${job.parsed.thumbDataUrl})` : "" }),
      h("dl", { class: "job-detail-meta", html:
        `<dt>file</dt><dd>${esc(job.name)} · ${(job.file.size/1024).toFixed(0)} KB</dd>` +
        `<dt>printer</dt><dd>${esc(job.detected || "?")}</dd>` +
        `<dt>plates</dt><dd>${job.parsed.plates.length}</dd>` +
        (m ? `<dt>layers</dt><dd>${m.totalLayers || "—"}</dd>` : "") +
        (m ? `<dt>height</dt><dd>${m.maxZ ? m.maxZ.toFixed(1) + " mm" : "—"}</dd>` : "") +
        (m ? `<dt>length</dt><dd>${m.filamentLengthMm ? (m.filamentLengthMm/1000).toFixed(2) + " m" : "—"}</dd>` : "")
      }),
      h("div", { class: "job-detail-actions" },
        h("button", { class: "btn-primary btn-small", onclick: async () => {
          try {
            const blob = await processOne(job);
            download(blob, outputName(job.name));
            toast(`downloaded ${outputName(job.name)}`, "ok");
          } catch (e) { console.error(e); toast(e.message, "err"); }
        } }, "download"),
        h("button", { class: "btn-ghost btn-small", onclick: () => {
          const dup = makeJob(job.file);
          dup.parsed = job.parsed; dup.plate = job.plate; dup.metrics = job.metrics;
          dup.detected = job.detected; dup.processed = job.processed;
          dup.status = job.status; dup.overrides = { ...job.overrides };
          dup.loop = job.loop;
          addJob(dup);
        } }, "duplicate"),
        h("button", { class: "btn-ghost btn-small", onclick: () => removeJob(job.id) }, "remove")
      )
    ),
    h("div", { class: "job-detail-main" },
      warnings.length ? h("div", { class: "warnings" },
        ...warnings.map((w) => h("div", { class: "warning" }, "⚠ ", w))
      ) : null,
      h("h4", {}, "tuning overrides"),
      grid,
      h("h4", {}, "cost · per run"),
      h("dl", { class: "cost-breakdown", html: costRows + `<dt class="total">total</dt><dd class="total">${fmtMoney(cost.total)}</dd>` }),
      h("h4", {}, `injection · +${diff.filter((d) => d.type === "add").length} lines`),
      diffNode
    )
  );
}

function renderSummary() {
  const foot = $("#summary");
  if (!state.jobs.length) { foot.hidden = true; return; }
  foot.hidden = false;

  let totalSecs = 0, totalGrams = 0, totalCost = 0, longestRun = 0;
  const perJobSecs = [], perJobGrams = [], perJobCost = [];
  const numJobs = state.jobs.reduce((a, j) => a + j.loop, 0);
  for (const j of state.jobs) {
    if (!j.metrics) continue;
    const tPer = parseDurationStr(j.metrics.totalTime || j.metrics.modelTime || "0s");
    const t = tPer * j.loop;
    const g = (j.metrics.filamentWeightG || 0) * j.loop;
    const c = estimateCost(j.metrics, state.cost).total * j.loop;
    totalSecs += t; totalGrams += g; totalCost += c;
    if (tPer > longestRun) longestRun = tPer;
    // expand per-loop into individual run values for sparklines (more honest)
    for (let i = 0; i < j.loop; i++) {
      perJobSecs.push(tPer);
      perJobGrams.push(j.metrics.filamentWeightG || 0);
      perJobCost.push(estimateCost(j.metrics, state.cost).total);
    }
  }

  const node = $("#stats");
  node.innerHTML = "";
  const stat = (label, value, unit, spark) => {
    node.appendChild(h("div", { class: "stat" },
      h("div", { class: "stat-label" }, label),
      h("div", { class: "stat-value", html: `${value}<span class="stat-unit">${unit || ""}</span>` }),
      h("div", { class: "stat-spark", html: spark || "" })
    ));
  };
  const showSpark = perJobSecs.length >= 3;
  stat("total time", formatDuration(totalSecs), "",
    showSpark ? sparkline(perJobSecs, { width: 140, height: 16 }) : "");
  stat("filament", totalGrams.toFixed(1), " g",
    showSpark ? sparkline(perJobGrams, { width: 140, height: 16 }) : "");
  stat("longest run", formatDuration(longestRun), "",
    showSpark ? dotplot(perJobSecs, { width: 140, height: 16 }) : "");
  stat("est. cost", fmtMoney(totalCost), "",
    showSpark ? sparkline(perJobCost, { width: 140, height: 16 }) : "");

  $("#btn-merge").disabled = state.jobs.length === 0;
  $("#btn-export-each").disabled = state.jobs.length === 0;
  const mergeLabel = numJobs > 1 ? `merge · ${numJobs} runs` : `merge · 1 run`;
  $("#btn-merge").innerHTML = mergeLabel;
}

function renderHwLabel() {
  const printer = PRINTERS.find((p) => p.id === state.printer);
  $(".hw-printer").textContent = printer ? printer.label : state.printer;
  $(".hw-stage").textContent = `Stage ${state.stage}`;
  $("#settings-preset-name").textContent = presetLabel(state.printer, state.stage);
}

function renderHwPopover() {
  const list = $("#printer-options");
  list.innerHTML = "";
  for (const p of PRINTERS) {
    const btn = h("button", {
      class: `popover-option ${p.id === state.printer ? "active" : ""}`,
      onclick: () => { setHardware(p.id, state.stage); $("#hw-popover").hidden = true; }
    }, h("span", {}, p.label), h("span", { class: "muted" }, p.modelIds.join(",")));
    list.appendChild(btn);
  }
  $$("#stage-options .popover-option").forEach((btn) => {
    const s = parseInt(btn.dataset.stage, 10);
    btn.classList.toggle("active", s === state.stage);
    btn.onclick = () => { setHardware(state.printer, s); $("#hw-popover").hidden = true; };
  });
}

function renderSettings() {
  const drawer = $("#settings-drawer");
  drawer.classList.toggle("open", state.drawerOpen);
  drawer.hidden = !state.drawerOpen;

  // Section visibility
  $$(".drawer-body").forEach((s) => { s.hidden = s.dataset.section !== state.drawerSection; });
  $$(".drawer-tab").forEach((t) => t.classList.toggle("active", t.dataset.section === state.drawerSection));

  // Tuning
  const preset = activePreset();
  const setVal = (id, val) => { const el = $(id); if (el && document.activeElement !== el && val !== undefined) el.value = String(val); };
  setVal("#set-cooldownTarget", preset.defaults.cooldownTarget);
  setVal("#set-cooldownOvershoot", preset.defaults.cooldownOvershoot);
  setVal("#set-dwell", preset.defaults.dwell);
  setVal("#set-nozzleTempIdle", preset.defaults.nozzleTempIdle);
  setVal("#set-bedTempReheat", preset.defaults.bedTempReheat);
  setVal("#set-repeats", preset.defaults.repeats);
  setVal("#set-zlift", preset.defaults.zlift);
  setVal("#set-parkz", preset.defaults.parkz);
  setVal("#set-pushx", preset.defaults.pushx);
  setVal("#set-returnx", preset.defaults.returnx);
  setVal("#set-pushspeed", preset.defaults.pushspeed);
  setVal("#set-returnspeed", preset.defaults.returnspeed);
  setVal("#set-parky", preset.defaults.parky);

  // Cost
  const c = state.cost;
  setVal("#cost-filament", c.filamentPerKg);
  setVal("#cost-power", c.electricityPerKwh);
  setVal("#cost-watts", c.printerWatts);
  setVal("#cost-labor", c.laborPerHour);
  setVal("#cost-laborper", c.laborMinutesPerPrint);
  setVal("#cost-deprec", c.depreciationPerHour);
  setVal("#cost-failure", c.failureRatePct);

  // Templates
  const preTA = $("#tpl-pre"), postTA = $("#tpl-post");
  if (document.activeElement !== preTA) preTA.value = preset.pre;
  if (document.activeElement !== postTA) postTA.value = preset.post;

  // Presets list
  const list = $("#preset-list");
  list.innerHTML = "";
  if (!state.presets.length) {
    list.appendChild(h("div", { class: "preset empty" }, "no saved presets yet"));
  } else {
    state.presets.forEach((p, i) => {
      list.appendChild(h("div", { class: "preset" },
        h("span", {}, p.name + " "), h("span", { class: "muted" }, `${p.printer} S${p.stage}`),
        h("button", { class: "preset-apply", onclick: () => applyPreset(i) }, "apply"),
        h("button", { onclick: () => deletePreset(i) }, "✕")
      ));
    });
  }
}

let renderScheduled = false;
function renderTo() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (state.jobs.length === 0) renderEmpty(); else renderJobsList();
    renderSummary();
    renderHwLabel();
    renderHwPopover();
    renderSettings();
  });
}

// ─── DOM wiring ───────────────────────────────────────────────────
function openFilePicker() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".3mf,.gcode"; input.multiple = true;
  input.onchange = () => ingest(input.files);
  input.click();
}

function wireDrop() {
  const overlay = $("#drop-overlay");
  let depth = 0;
  window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    if (++depth === 1) overlay.hidden = false;
  });
  window.addEventListener("dragover", (e) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; overlay.hidden = true; } });
  window.addEventListener("drop", (e) => {
    e.preventDefault(); depth = 0; overlay.hidden = true;
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) ingest(files);
  });
}

function wireHwPicker() {
  const btn = $("#hw-picker");
  const pop = $("#hw-popover");
  btn.addEventListener("click", () => {
    if (!pop.hidden) { pop.hidden = true; return; }
    const r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + "px";
    pop.style.left = r.left + "px";
    pop.hidden = false;
  });
  document.addEventListener("click", (e) => {
    if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) pop.hidden = true;
  });
}

function wireSettings() {
  $("#open-settings").addEventListener("click", () => { state.drawerOpen = !state.drawerOpen; notify(); });
  $("#close-settings").addEventListener("click", () => { state.drawerOpen = false; notify(); });
  $$(".drawer-tab").forEach((t) => t.addEventListener("click", () => { state.drawerSection = t.dataset.section; notify(); }));

  // Tuning inputs
  const tuningFields = [
    ["cooldownTarget", "#set-cooldownTarget"], ["cooldownOvershoot", "#set-cooldownOvershoot"],
    ["dwell", "#set-dwell"], ["nozzleTempIdle", "#set-nozzleTempIdle"],
    ["bedTempReheat", "#set-bedTempReheat"], ["repeats", "#set-repeats"],
    ["zlift", "#set-zlift"], ["parkz", "#set-parkz"],
    ["pushx", "#set-pushx"], ["returnx", "#set-returnx"],
    ["pushspeed", "#set-pushspeed"], ["returnspeed", "#set-returnspeed"],
    ["parky", "#set-parky"]
  ];
  tuningFields.forEach(([key, sel]) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v)) setDefaults({ [key]: v });
    });
  });

  // Cost inputs
  const costFields = [
    ["filamentPerKg", "#cost-filament"], ["electricityPerKwh", "#cost-power"],
    ["printerWatts", "#cost-watts"], ["laborPerHour", "#cost-labor"],
    ["laborMinutesPerPrint", "#cost-laborper"], ["depreciationPerHour", "#cost-deprec"],
    ["failureRatePct", "#cost-failure"]
  ];
  costFields.forEach(([key, sel]) => {
    $(sel).addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (isFinite(v)) setCost({ [key]: v });
    });
  });

  // Templates
  $("#tpl-pre").addEventListener("input", (e) => saveTemplate({ pre: e.target.value, post: $("#tpl-post").value }));
  $("#tpl-post").addEventListener("input", (e) => saveTemplate({ pre: $("#tpl-pre").value, post: e.target.value }));
  $("#tpl-restore").addEventListener("click", () => { if (confirm("restore default templates for this hardware?")) { restoreTemplate(); resetDefaults(); } });

  // Presets
  $("#preset-save").addEventListener("click", () => {
    const name = $("#preset-name").value.trim();
    if (!name) { toast("name required", "err"); return; }
    savePreset(name); $("#preset-name").value = "";
  });
}

function wirePalette() {
  const dlg = $("#palette");
  const input = $("#palette-input");
  const list = $("#palette-list");
  let active = 0;

  function commands() {
    return [
      { label: "add files", hint: "open file picker", run: openFilePicker },
      { label: "merge → 1 file", hint: "download combined", run: () => $("#btn-merge").click(), disabled: !state.jobs.length },
      { label: "download each", hint: "process all jobs", run: () => $("#btn-export-each").click(), disabled: !state.jobs.length },
      { label: "settings", hint: "open drawer", run: () => { state.drawerOpen = true; notify(); } },
      { label: "switch hardware", hint: "open picker", run: () => $("#hw-picker").click() },
      { label: "clear queue", hint: "remove all", run: () => { state.jobs.length = 0; state.expandedId = null; notify(); }, disabled: !state.jobs.length },
      ...state.jobs.map((j) => ({ label: `expand: ${j.name}`, hint: `×${j.loop}`, run: () => toggleExpand(j.id) }))
    ];
  }

  function render() {
    const q = input.value.toLowerCase();
    const items = commands().filter((c) => !q || c.label.toLowerCase().includes(q));
    list.innerHTML = "";
    items.forEach((c, i) => {
      const li = h("li", { class: i === active ? "active" : "", onclick: () => run(c) },
        h("span", {}, c.label), h("span", { class: "palette-hint" }, c.hint || ""));
      if (c.disabled) li.style.opacity = "0.4";
      list.appendChild(li);
    });
    list._items = items;
  }
  function run(c) { if (c.disabled) return; dlg.close(); c.run(); }

  $("#open-palette").addEventListener("click", () => { dlg.showModal(); input.value = ""; active = 0; render(); input.focus(); });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (dlg.open) dlg.close(); else { dlg.showModal(); input.value = ""; active = 0; render(); input.focus(); }
    }
  });
  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (e) => {
    const items = list._items || [];
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); render(); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) run(items[active]); }
  });
}

function wireSummary() {
  $("#btn-merge").addEventListener("click", async () => {
    try {
      const blob = await processMerge(state.jobs);
      const total = state.jobs.reduce((a, j) => a + j.loop, 0);
      download(blob, `farm_S${state.stage}_${total}jobs.gcode.3mf`);
      toast(`merged ${total} jobs`, "ok");
    } catch (e) { console.error(e); toast(e.message, "err"); }
  });
  $("#btn-export-each").addEventListener("click", async () => {
    for (const j of state.jobs) {
      try {
        const blob = await processOne(j);
        download(blob, outputName(j.name));
      } catch (e) { console.error(e); toast(`${j.name}: ${e.message}`, "err"); }
    }
    toast(`processed ${state.jobs.length}`, "ok");
  });
}

// ─── Keyboard navigation ─────────────────────────────────────────
function wireKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Ignore when typing in inputs/textareas/inside the palette dialog
    const t = e.target;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
    if ($("#palette").open) return;

    if (!state.jobs.length) return;

    const ids = state.jobs.map((j) => j.id);
    const focusedIdx = state.expandedId ? ids.indexOf(state.expandedId) : -1;

    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      const next = focusedIdx < 0 ? 0 : Math.min(ids.length - 1, focusedIdx + 1);
      state.expandedId = ids[next]; notify();
      scrollJobIntoView(ids[next]);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      const next = focusedIdx < 0 ? ids.length - 1 : Math.max(0, focusedIdx - 1);
      state.expandedId = ids[next]; notify();
      scrollJobIntoView(ids[next]);
    } else if (e.key === "Enter" && focusedIdx >= 0) {
      // Trigger download for expanded
      e.preventDefault();
      const job = state.jobs[focusedIdx];
      processOne(job).then((b) => { download(b, outputName(job.name)); toast(`downloaded ${outputName(job.name)}`, "ok"); }).catch((err) => toast(err.message, "err"));
    } else if ((e.key === "Backspace" || e.key === "Delete") && focusedIdx >= 0) {
      e.preventDefault();
      const job = state.jobs[focusedIdx];
      removeJob(job.id);
    } else if (e.key === "d" && focusedIdx >= 0 && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const job = state.jobs[focusedIdx];
      const dup = makeJob(job.file);
      Object.assign(dup, { parsed: job.parsed, plate: job.plate, metrics: job.metrics, detected: job.detected, processed: job.processed, status: job.status, overrides: { ...job.overrides }, loop: job.loop });
      addJob(dup);
    }
  });
}

function scrollJobIntoView(id) {
  const el = document.querySelector(`.job[data-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Boot ─────────────────────────────────────────────────────────
subscribe(renderTo);
wireDrop();
wireHwPicker();
wireSettings();
wirePalette();
wireSummary();
wireKeyboard();
renderTo();

// Expose for tests / debugging
window.farm = { state, ingest, processOne, processMerge };
