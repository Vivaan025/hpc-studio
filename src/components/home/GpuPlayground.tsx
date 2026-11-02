"use client";

import { useEffect, useRef, useState } from "react";

/*
  GpuPlayground — a tiny, dependency-free canvas toy for the home page.

  Click and a burst of thread blocks flies from the CPU into the GPU. Each block
  grabs a free slot on a streaming multiprocessor, lights up its cores while it
  runs, then retires with a little pop. If every SM is busy, blocks wait at the
  door, which is how real GPUs behave.

  Hidden things (don't tell anyone):
    · hold the mouse down            → continuous launching
    · hover an SM                     → live occupancy readout
    · double-click an SM              → it throttles for a few seconds, work reroutes
    · click the CPU five times fast   → graph mode: launches arrive as one tight train
    · click the PCIe label            → bandwidth upgrade, blocks fly faster
    · type  c u d a  anywhere         → a tensor-core wave with confetti
    · press  o                        → overclock for 12 seconds
    · retire 100 / 500 / 1000 / 4096 blocks → achievements

  Cheap on purpose: one canvas, one requestAnimationFrame loop, a few dozen
  particles, paused when off-screen or tab-hidden, static for reduced motion.
*/

const SM_COLS = 4;
const SM_ROWS = 2;
const NUM_SM = SM_COLS * SM_ROWS;
const SLOTS_PER_SM = 4;
const CORES_PER_SLOT = 4;
const MAX_FLYING = 64;

const C = {
  die: "#efe4cd", dieBorder: "#cbbb98",
  sm: "#f3eadb", smBorder: "#cbbb98", smBusyBorder: "#5e4a30", smThrottled: "#e5d9c0",
  coreIdle: "#e0d3b6", coreOn: "#2a1c0d", coreHot: "#b9452b",
  block: "#5e4a30", blockQueued: "#a69272", blockGraph: "#2a1c0d",
  cpu: "#2a1c0d", cpuText: "#f7f0e1", text: "#5e4a30", muted: "#967f5e",
  pop: "#967f5e", wire: "#cbbb98", tooltipBg: "#2a1c0d", tooltipText: "#f7f0e1",
};
const CONFETTI = ["#b9452b", "#d9a441", "#4f7a4a", "#3b6b8f", "#8a4f9e", "#2a1c0d"];

const MILESTONES: [number, string][] = [
  [100, "100 blocks retired · you are now a warp"],
  [500, "500 blocks retired · you are now a block"],
  [1000, "1000 blocks retired · you are now a grid"],
  [4096, "4096 blocks retired · go write a real kernel"],
];

type BlockState = "flying" | "queued" | "running" | "done";
interface Block {
  x: number; y: number; tx: number; ty: number;
  state: BlockState; sm: number; slot: number;
  progress: number; duration: number; wobble: number; speed: number; born: number;
  graph: boolean;
}
interface Pop { x: number; y: number; t: number }
interface Confetti { x: number; y: number; vx: number; vy: number; t: number; color: string; r: number }
interface Rect { x: number; y: number; w: number; h: number }
interface Layout { w: number; h: number; cpu: Rect; die: Rect; sms: Rect[]; queue: { x: number; y: number }; core: number; pcie: Rect }

function layout(w: number, h: number): Layout {
  const pad = Math.max(10, w * 0.03);
  const cpuW = Math.max(44, w * 0.11);
  const cpu = { x: pad, y: h / 2 - cpuW * 0.6, w: cpuW, h: cpuW * 1.2 };
  const dieX = cpu.x + cpu.w + w * 0.14;
  const die = { x: dieX, y: pad, w: w - dieX - pad, h: h - pad * 2 };
  const gap = Math.max(6, die.w * 0.025);
  const smW = (die.w - gap * (SM_COLS + 1)) / SM_COLS;
  const smH = (die.h - gap * (SM_ROWS + 1) - 14) / SM_ROWS;
  const sms: Rect[] = [];
  for (let r = 0; r < SM_ROWS; r++)
    for (let c = 0; c < SM_COLS; c++)
      sms.push({ x: die.x + gap + c * (smW + gap), y: die.y + gap + 14 + r * (smH + gap), w: smW, h: smH });
  const core = Math.min(smW / (CORES_PER_SLOT + 1.5), smH / (SLOTS_PER_SM + 2.2));
  const queue = { x: die.x - w * 0.055, y: h / 2 };
  const mid = (cpu.x + cpu.w + die.x) / 2;
  const pcie = { x: mid - 22, y: h / 2 - 20, w: 44, h: 22 };
  return { w, h, cpu, die, sms, queue, core, pcie };
}
function slotCenter(L: Layout, sm: number, slot: number) {
  const s = L.sms[sm];
  const rowH = (s.h - 14) / SLOTS_PER_SM;
  return { x: s.x + s.w / 2, y: s.y + 12 + rowH * slot + rowH / 2 };
}
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export default function GpuPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [retired, setRetired] = useState(0);
  const [launched, setLaunched] = useState(0);
  const [occupancy, setOccupancy] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<{ graph: boolean; overclock: boolean; pcie: number }>({ graph: false, overclock: false, pcie: 4 });
  const api = useRef<{ launch: (n?: number) => void; down: (x: number, y: number) => void; up: () => void; move: (x: number, y: number) => void; leave: () => void; dbl: (x: number, y: number) => void }>({
    launch: () => {}, down: () => {}, up: () => {}, move: () => {}, leave: () => {}, dbl: () => {},
  });

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let L = layout(300, 190);
    let blocks: Block[] = [];
    let pops: Pop[] = [];
    let confetti: Confetti[] = [];
    const slots: (Block | null)[][] = Array.from({ length: NUM_SM }, () => Array(SLOTS_PER_SM).fill(null));
    const throttledUntil = new Array<number>(NUM_SM).fill(0);
    let retiredCount = 0, launchedCount = 0, manualLaunches = 0;
    let visible = true, raf = 0, last = performance.now(), idleTimer = 0, statTimer = 0, dpr = 1;
    let simNow = 0;
    let mouse: { x: number; y: number } | null = null;
    let holding = false, holdTimer = 0;
    let graphMode = false, overclockUntil = 0, pcieGen = 4;
    let cpuClicks: number[] = [];
    let keyBuf: string[] = [];
    let toastTimer: number | undefined;
    let milestoneIdx = 0;
    let banner: { text: string; until: number } | null = null;

    const say = (text: string, ms = 3200) => {
      setToast(text);
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => setToast(null), ms);
    };
    const flash = (text: string, secs = 2.2) => { banner = { text, until: simNow + secs }; };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(280, rect.width);
      const h = Math.round(w * 0.56);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      L = layout(w, h);
      for (const b of blocks) if (b.state === "running") { const p = slotCenter(L, b.sm, b.slot); b.x = p.x; b.y = p.y; }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const findFreeSlot = () => {
      let bestSm = -1, bestSlot = -1, bestLoad = Infinity;
      for (let sm = 0; sm < NUM_SM; sm++) {
        if (throttledUntil[sm] > simNow) continue;
        const load = slots[sm].filter(Boolean).length;
        const slot = slots[sm].indexOf(null);
        if (slot >= 0 && load < bestLoad) { bestSm = sm; bestSlot = slot; bestLoad = load; }
      }
      return bestSm >= 0 ? { sm: bestSm, slot: bestSlot } : null;
    };

    const speedMul = () => (overclockUntil > simNow ? 2.2 : 1) * (pcieGen >= 5 ? 1.35 : 1);

    const launch = (n = 8 + Math.floor(Math.random() * 6), opts: { silent?: boolean } = {}) => {
      const inFlight = blocks.filter((b) => b.state !== "running").length;
      const count = Math.min(n, MAX_FLYING - inFlight);
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        blocks.push({
          x: L.cpu.x + L.cpu.w / 2 + (Math.random() - 0.5) * 8,
          y: L.cpu.y + L.cpu.h / 2 + (Math.random() - 0.5) * 8,
          tx: L.queue.x, ty: L.queue.y,
          state: "flying", sm: -1, slot: -1,
          progress: 0, duration: 1.1 + Math.random() * 1.4,
          wobble: Math.random() * Math.PI * 2,
          speed: (2.6 + Math.random() * 1.2),
          born: simNow + i * (graphMode ? 0.012 : 0.045),
          graph: graphMode,
        });
      }
      if (!opts.silent) { launchedCount += 1; setLaunched(launchedCount); }
    };

    const assign = (b: Block) => {
      const f = findFreeSlot();
      if (!f) { b.state = "queued"; return; }
      b.state = "flying"; b.sm = f.sm; b.slot = f.slot; slots[f.sm][f.slot] = b;
      const p = slotCenter(L, f.sm, f.slot); b.tx = p.x; b.ty = p.y;
    };

    const burstConfetti = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
        confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, color: CONFETTI[i % CONFETTI.length], r: Math.random() * Math.PI });
      }
      if (confetti.length > 160) confetti = confetti.slice(-160);
    };

    // ── interactions ──
    api.current.launch = (n) => { manualLaunches++; launch(n); };
    api.current.down = (x, y) => {
      manualLaunches++;
      if (inRect(L.cpu, x, y)) {
        cpuClicks = [...cpuClicks.filter((t) => simNow - t < 1.6), simNow];
        if (cpuClicks.length >= 5) {
          cpuClicks = [];
          graphMode = !graphMode;
          setMode((m) => ({ ...m, graph: graphMode }));
          flash(graphMode ? "cudaGraphLaunch: launches now arrive as one train" : "back to plain stream launches", 3);
        }
        launch(graphMode ? 16 : 6);
        return;
      }
      if (inRect(L.pcie, x, y)) {
        pcieGen = pcieGen >= 5 ? 4 : 5;
        setMode((m) => ({ ...m, pcie: pcieGen }));
        flash(pcieGen >= 5 ? "PCIe 5.0 · bandwidth upgraded" : "PCIe 4.0 · back to stock", 2.4);
        burstConfetti(L.pcie.x + L.pcie.w / 2, L.pcie.y + L.pcie.h / 2, 18);
        return;
      }
      holding = true; holdTimer = 0;
      launch();
    };
    api.current.up = () => { holding = false; };
    api.current.move = (x, y) => { mouse = { x, y }; };
    api.current.leave = () => { mouse = null; holding = false; };
    api.current.dbl = (x, y) => {
      const i = L.sms.findIndex((s) => inRect(s, x, y));
      if (i < 0) return;
      throttledUntil[i] = simNow + 6;
      flash(`SM${i} throttled · scheduler reroutes around it`, 2.6);
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      keyBuf = [...keyBuf, e.key].slice(-10);
      if (e.key.toLowerCase() === "o" && overclockUntil <= simNow) {
        keyBuf = [];
        overclockUntil = simNow + 12;
        setMode((m) => ({ ...m, overclock: true }));
        window.setTimeout(() => setMode((m) => ({ ...m, overclock: false })), 12000);
        flash("OVERCLOCKED · 2.2× clocks for 12 s · warranty void", 3.5);
        burstConfetti(L.die.x + L.die.w / 2, L.die.y + L.die.h / 2, 60);
        launch(24);
      }
      if (keyBuf.slice(-4).join("").toLowerCase() === "cuda") {
        keyBuf = [];
        flash("tensor core wave incoming", 2.5);
        for (let i = 0; i < 4; i++) window.setTimeout(() => { launch(16, { silent: i > 0 }); }, i * 260);
        burstConfetti(L.cpu.x + L.cpu.w / 2, L.cpu.y + L.cpu.h / 2, 40);
      }
    };
    window.addEventListener("keydown", onKey);

    // ── simulation ──
    const step = (dt: number) => {
      simNow += dt;
      const mul = speedMul();

      if (holding) { holdTimer += dt; if (holdTimer > 0.13) { holdTimer = 0; launch(3, { silent: true }); } }

      for (const b of blocks) if (b.state === "queued") { assign(b); if (b.state === "queued") break; }

      let qi = 0;
      for (const b of blocks) {
        if (simNow < b.born) continue;
        if (b.state === "flying") {
          const k = 1 - Math.exp(-b.speed * mul * dt * 2.2);
          b.x += (b.tx - b.x) * k;
          b.y += (b.ty - b.y) * k + (b.graph ? 0 : Math.sin(simNow * 6 + b.wobble) * 0.25);
          if (Math.hypot(b.tx - b.x, b.ty - b.y) < 2) {
            if (b.sm < 0) assign(b);
            else { b.state = "running"; b.x = b.tx; b.y = b.ty; }
          }
        } else if (b.state === "queued") {
          const col = Math.floor(qi / 7), row = qi % 7; qi++;
          const tx = L.queue.x - col * 10, ty = L.queue.y + (row - 3) * 9;
          b.x += (tx - b.x) * 0.2; b.y += (ty - b.y) * 0.2;
        } else if (b.state === "running") {
          b.progress += (dt * mul) / b.duration;
          if (b.progress >= 1) {
            b.state = "done"; slots[b.sm][b.slot] = null; retiredCount++;
            pops.push({ x: b.x, y: b.y, t: 0 });
            if (milestoneIdx < MILESTONES.length && retiredCount >= MILESTONES[milestoneIdx][0]) {
              say(MILESTONES[milestoneIdx][1], 4200);
              burstConfetti(b.x, b.y, 30);
              milestoneIdx++;
            }
          }
        }
      }
      blocks = blocks.filter((b) => b.state !== "done");
      for (const p of pops) p.t += dt * 2.2;
      pops = pops.filter((p) => p.t < 1);
      for (const c of confetti) { c.t += dt; c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += dt * 6; }
      confetti = confetti.filter((c) => c.t < 1.4 && c.y < L.h + 10);

      statTimer += dt;
      if (statTimer > 0.25) {
        statTimer = 0;
        setRetired(retiredCount);
        const used = slots.flat().filter(Boolean).length;
        setOccupancy(Math.round((used / (NUM_SM * SLOTS_PER_SM)) * 100));
      }
      if (!reduced) {
        idleTimer += dt;
        if (idleTimer > 2.8 && blocks.length < 6) { idleTimer = 0; launch(4 + Math.floor(Math.random() * 5), { silent: true }); }
      }
    };

    // ── drawing ──
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };

    const draw = () => {
      const oc = overclockUntil > simNow;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      ctx.font = "9px JetBrains Mono, ui-monospace, monospace";
      ctx.textBaseline = "middle";

      // wire + PCIe label (clickable)
      ctx.strokeStyle = C.wire; ctx.lineWidth = pcieGen >= 5 ? 2 : 1; ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -simNow * 20 * (pcieGen >= 5 ? 2 : 1);
      ctx.beginPath(); ctx.moveTo(L.cpu.x + L.cpu.w, L.h / 2); ctx.lineTo(L.die.x, L.h / 2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      const pcieHover = mouse && inRect(L.pcie, mouse.x, mouse.y);
      ctx.fillStyle = pcieHover ? C.text : C.muted; ctx.textAlign = "center";
      ctx.fillText(pcieGen >= 5 ? "PCIe 5.0" : "PCIe", L.pcie.x + L.pcie.w / 2, L.h / 2 - 9);

      // CPU
      const cpuHover = mouse && inRect(L.cpu, mouse.x, mouse.y);
      ctx.fillStyle = C.cpu; roundRect(L.cpu.x, L.cpu.y, L.cpu.w, L.cpu.h, 3); ctx.fill();
      if (cpuHover) { ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = C.cpuText; ctx.textAlign = "center";
      ctx.fillText("CPU", L.cpu.x + L.cpu.w / 2, L.cpu.y + L.cpu.h / 2 - (graphMode ? 6 : 0));
      if (graphMode) { ctx.fillStyle = C.blockQueued; ctx.fillText("graph", L.cpu.x + L.cpu.w / 2, L.cpu.y + L.cpu.h / 2 + 7); }

      // Die
      ctx.fillStyle = C.die; ctx.strokeStyle = oc ? C.coreHot : C.dieBorder; ctx.lineWidth = oc ? 1.5 : 1;
      roundRect(L.die.x, L.die.y, L.die.w, L.die.h, 4); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = oc ? C.coreHot : C.muted; ctx.textAlign = "left";
      ctx.fillText(oc ? `GPU · 8 SMs · OVERCLOCKED ${Math.ceil(overclockUntil - simNow)}s` : "GPU · 8 SMs", L.die.x + 8, L.die.y + 9);

      // SMs
      let hoverSm = -1;
      L.sms.forEach((s, i) => {
        const busy = slots[i].some(Boolean);
        const throttled = throttledUntil[i] > simNow;
        const hover = mouse && inRect(s, mouse.x, mouse.y);
        if (hover) hoverSm = i;
        ctx.fillStyle = throttled ? C.smThrottled : C.sm;
        ctx.strokeStyle = hover ? C.cpu : busy ? C.smBusyBorder : C.smBorder;
        roundRect(s.x, s.y, s.w, s.h, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.muted; ctx.textAlign = "left";
        ctx.fillText(throttled ? `SM${i} zZ` : `SM${i}`, s.x + 4, s.y + 7);
        const rowH = (s.h - 14) / SLOTS_PER_SM, core = L.core;
        const gridW = CORES_PER_SLOT * core + (CORES_PER_SLOT - 1) * 2;
        const x0 = s.x + (s.w - gridW) / 2;
        for (let slot = 0; slot < SLOTS_PER_SM; slot++) {
          const b = slots[i][slot];
          const cy = s.y + 12 + rowH * slot + rowH / 2 - core / 2;
          const lit = b && b.state === "running" ? Math.ceil(b.progress * CORES_PER_SLOT) : 0;
          for (let c = 0; c < CORES_PER_SLOT; c++) {
            const on = c < lit;
            ctx.fillStyle = on ? (oc && Math.sin(simNow * 18 + c + slot) > 0 ? C.coreHot : C.coreOn) : (throttled ? C.smThrottled : C.coreIdle);
            ctx.fillRect(x0 + c * (core + 2), cy, core, core);
          }
        }
      });

      // flying / queued blocks
      for (const b of blocks) {
        if (simNow < b.born || b.state === "running") continue;
        const sz = 7;
        ctx.fillStyle = b.state === "queued" ? C.blockQueued : b.graph ? C.blockGraph : C.block;
        ctx.fillRect(b.x - sz / 2, b.y - sz / 2, sz, sz);
      }

      // pops
      for (const p of pops) {
        ctx.strokeStyle = C.pop; ctx.globalAlpha = 1 - p.t; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + p.t * 12, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineWidth = 1;

      // confetti
      for (const c of confetti) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
        ctx.globalAlpha = Math.max(0, 1 - c.t / 1.4);
        ctx.fillStyle = c.color; ctx.fillRect(-3, -2, 6, 4); ctx.restore();
      }
      ctx.globalAlpha = 1;

      // queue label
      const q = blocks.filter((b) => b.state === "queued").length;
      if (q > 0) { ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.fillText(`${q} waiting`, L.queue.x, L.queue.y + 40); }

      // SM tooltip
      if (hoverSm >= 0) {
        const used = slots[hoverSm].filter(Boolean).length;
        const throttled = throttledUntil[hoverSm] > simNow;
        const txt = throttled ? `SM${hoverSm} · throttled ${Math.ceil(throttledUntil[hoverSm] - simNow)}s` : `SM${hoverSm} · ${used}/${SLOTS_PER_SM} blocks · ${Math.round((used / SLOTS_PER_SM) * 100)}%`;
        const tw = ctx.measureText(txt).width + 12;
        const tx = Math.min(L.w - tw - 4, Math.max(4, (mouse?.x ?? 0) + 10));
        const ty = Math.max(12, (mouse?.y ?? 0) - 16);
        ctx.fillStyle = C.tooltipBg; roundRect(tx, ty - 9, tw, 18, 2); ctx.fill();
        ctx.fillStyle = C.tooltipText; ctx.textAlign = "left"; ctx.fillText(txt, tx + 6, ty);
      }

      // banner (easter egg feedback)
      if (banner && banner.until > simNow) {
        const a = Math.min(1, (banner.until - simNow) / 0.6);
        ctx.globalAlpha = a;
        ctx.font = "bold 10px JetBrains Mono, ui-monospace, monospace";
        const tw = ctx.measureText(banner.text).width + 16;
        const bx = L.w / 2 - tw / 2, by = L.h - 18;
        ctx.fillStyle = C.tooltipBg; roundRect(bx, by - 10, tw, 20, 2); ctx.fill();
        ctx.fillStyle = C.tooltipText; ctx.textAlign = "center"; ctx.fillText(banner.text, L.w / 2, by);
        ctx.globalAlpha = 1;
        ctx.font = "9px JetBrains Mono, ui-monospace, monospace";
      } else if (manualLaunches === 0 && !reduced) {
        // hint until first interaction
        const a = 0.55 + 0.45 * Math.sin(simNow * 2);
        ctx.globalAlpha = a; ctx.fillStyle = C.muted; ctx.textAlign = "right";
        ctx.fillText("click anywhere to launch a kernel", L.w - 8, L.h - 8);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.05 });
    io.observe(wrap);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    const kickoff = window.setTimeout(() => {
      if (reduced) {
        for (let i = 0; i < 9; i++) {
          const f = findFreeSlot(); if (!f) break;
          const b: Block = { x: 0, y: 0, tx: 0, ty: 0, state: "running", sm: f.sm, slot: f.slot, progress: (i % 4 + 1) / 4, duration: 1, wobble: 0, speed: 0, born: 0, graph: false };
          slots[f.sm][f.slot] = b; blocks.push(b);
        }
        draw();
        setOccupancy(Math.round((9 / (NUM_SM * SLOTS_PER_SM)) * 100));
      } else {
        launch(10, { silent: true });
        start();
      }
    }, 0);

    return () => {
      window.clearTimeout(kickoff); if (toastTimer) window.clearTimeout(toastTimer);
      stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const pos = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="border border-[#dccfb2] bg-[#f3eadb] select-none relative">
      <div
        ref={wrapRef}
        className="w-full cursor-pointer touch-none"
        onPointerDown={(e) => { const p = pos(e); api.current.down(p.x, p.y); }}
        onPointerUp={() => api.current.up()}
        onPointerMove={(e) => { const p = pos(e); api.current.move(p.x, p.y); }}
        onPointerLeave={() => api.current.leave()}
        onDoubleClick={(e) => { const p = pos(e); api.current.dbl(p.x, p.y); }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          aria-label="Animated GPU: thread blocks fly from the CPU into streaming multiprocessors, light up cores while they run, then retire."
        />
      </div>

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 px-3 py-1.5 bg-[#2a1c0d] text-[#f7f0e1] text-[11px] font-mono shadow-sm pointer-events-none">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-[#dccfb2] text-[10px] font-mono text-[#5e4a30]">
        <div className="flex items-center gap-4 flex-wrap">
          <span>kernels <span className="text-[#2a1c0d] font-semibold">{launched}</span></span>
          <span>blocks retired <span className="text-[#2a1c0d] font-semibold">{retired}</span></span>
          <span>occupancy <span className="text-[#2a1c0d] font-semibold">{occupancy}%</span></span>
          {mode.graph && <span className="text-[#967f5e]">graph mode</span>}
          {mode.pcie >= 5 && <span className="text-[#967f5e]">pcie 5.0</span>}
          {mode.overclock && <span className="text-[#b9452b] font-semibold">overclocked</span>}
        </div>
        <button
          onClick={() => api.current.launch(16)}
          className="px-2 py-1 border border-[#2a1c0d] bg-[#2a1c0d] text-[#f7f0e1] uppercase tracking-wider hover:bg-[#41301c] transition-colors shrink-0"
        >
          Launch kernel
        </button>
      </div>
    </div>
  );
}
