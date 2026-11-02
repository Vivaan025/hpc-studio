"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import SimulationControls from "./SimulationControls";
import SimulationCodePanel from "./SimulationCodePanel";
import ThreadInfoPanel from "./ThreadInfoPanel";

// ── Syntax helpers for code display ──
const K = (s: string) => `<span style="font-weight:700">${s}</span>`;
const TY = (s: string) => `<span style="color:#5e4a30">${s}</span>`;
const F = (s: string) => `<span style="font-weight:600">${s}</span>`;
const NUM = (s: string) => `<span style="font-weight:600">${s}</span>`;
const CM = (s: string) => `<span style="color:#967f5e;font-style:italic">${s}</span>`;

const CODE_LINES: { tag: string; html: string }[] = [
  { tag: "wsig",  html: `${K("__device__")} ${TY("float")} ${F("warp_reduce_sum")}(${TY("float")} val) {` },
  { tag: "wfor",  html: `    ${K("for")} (${TY("int")} offset = warpSize / ${NUM("2")}; offset > ${NUM("0")}; offset >>= ${NUM("1")}) {` },
  { tag: "wshfl", html: `        val += ${F("__shfl_down_sync")}(${NUM("0xffffffff")}, val, offset);` },
  { tag: "",      html: `    }` },
  { tag: "wret",  html: `    ${K("return")} val;` },
  { tag: "",      html: `}` },
  { tag: "",      html: `` },
  { tag: "bsig",  html: `${K("__device__")} ${TY("float")} ${F("block_reduce_sum")}(${TY("float")} val) {` },
  { tag: "smem",  html: `    ${K("__shared__")} ${TY("float")} t[${NUM("32")}];` },
  { tag: "idx",   html: `    ${TY("int")} lane   = threadIdx.x % warpSize;` },
  { tag: "idx",   html: `    ${TY("int")} warpId = threadIdx.x / warpSize;` },
  { tag: "",      html: `` },
  { tag: "warp",  html: `    val = ${F("warp_reduce_sum")}(val);        ${CM("// each warp → 1 value")}` },
  { tag: "",      html: `` },
  { tag: "write", html: `    ${K("if")} (lane == ${NUM("0")}) {` },
  { tag: "write", html: `        t[warpId] = val;                ${CM("// lane 0 publishes")}` },
  { tag: "write", html: `    }` },
  { tag: "sync",  html: `    ${F("__syncthreads")}();` },
  { tag: "",      html: `` },
  { tag: "load",  html: `    ${K("if")} (warpId == ${NUM("0")}) {` },
  { tag: "load",  html: `        ${TY("int")} numWarps = (blockDim.x + warpSize - ${NUM("1")}) / warpSize;` },
  { tag: "load",  html: `        val = (threadIdx.x < numWarps) ? t[lane] : ${NUM("0.0f")};` },
  { tag: "warp0", html: `        val = ${F("warp_reduce_sum")}(val);    ${CM("// partials → total")}` },
  { tag: "",      html: `    }` },
  { tag: "ret",   html: `    ${K("return")} val;                     ${CM("// valid in thread 0")}` },
  { tag: "",      html: `}` },
];

// ── Types ──
interface Step {
  t: "warp" | "write" | "sync" | "load" | "warp0" | "ret";
  off?: number;
}

interface SimState {
  v: number[];
  t: (number | null)[];
  w0: number[] | null;
  aliveLanes: number;
  alive0: number;
}

function buildInitialValues(L: number, NW: number): number[] {
  return Array.from({ length: L * NW }, (_, i) => ((i * 7 + (i >> 3) * 3) % 9) + 1);
}

function buildSteps(L: number): Step[] {
  const steps: Step[] = [];
  for (let off = L / 2; off > 0; off >>= 1) steps.push({ t: "warp", off });
  steps.push({ t: "write" });
  steps.push({ t: "sync" });
  steps.push({ t: "load" });
  for (let off = L / 2; off > 0; off >>= 1) steps.push({ t: "warp0", off });
  steps.push({ t: "ret" });
  return steps;
}

function simulate(V0: number[], steps: Step[], upTo: number, L: number, NW: number): SimState {
  const v = V0.slice();
  const t: (number | null)[] = Array(32).fill(null);
  let w0: number[] | null = null;
  let aliveLanes = L;
  let alive0 = L;

  for (let s = 0; s <= upTo; s++) {
    const st = steps[s];
    if (st.t === "warp") {
      for (let w = 0; w < NW; w++)
        for (let l = 0; l < st.off!; l++) v[w * L + l] += v[w * L + l + st.off!];
      aliveLanes = st.off!;
    } else if (st.t === "write") {
      for (let w = 0; w < NW; w++) t[w] = v[w * L];
    } else if (st.t === "load") {
      w0 = Array.from({ length: L }, (_, l) => (l < NW ? t[l]! : 0));
    } else if (st.t === "warp0") {
      for (let l = 0; l < st.off!; l++) w0![l] += w0![l + st.off!];
      alive0 = st.off!;
    }
  }
  return { v, t, w0, aliveLanes, alive0 };
}

// ── Phase labels for the pipeline indicator ──
const PHASES = [
  { key: "warp", label: "Warp Shuffle" },
  { key: "write", label: "Lane 0 Writes" },
  { key: "sync", label: "__syncthreads()" },
  { key: "load", label: "Warp 0 Loads" },
  { key: "warp0", label: "Warp Shuffle" },
  { key: "ret", label: "Return" },
];

// ── Component ──
export default function BlockReduceSimulation() {
  const [L, setL] = useState(16);
  const [NW, setNW] = useState(4);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [showCode, setShowCode] = useState(true);
  const [showTags, setShowTags] = useState(false);

  const V0 = useRef(buildInitialValues(L, NW));
  const steps = useRef(buildSteps(L));

  // Rebuild data when config changes
  const resetAll = useCallback(() => {
    V0.current = buildInitialValues(L, NW);
    steps.current = buildSteps(L);
    setIdx(-1);
    setPlaying(false);
  }, [L, NW]);

  useEffect(() => { resetAll(); }, [L, NW, resetAll]);

  // Playback
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delay = () => 1500 - speed * 130;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next >= steps.current.length) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
    };
    // Initial tick
    if (idx < 0) {
      setIdx(0);
    }
    timerRef.current = setInterval(tick, delay());
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, idx]);

  const handlePlay = () => {
    if (idx >= steps.current.length - 1) { setIdx(-1); }
    setPlaying(true);
  };
  const handleStep = () => { setPlaying(false); setIdx((p) => Math.min(p + 1, steps.current.length - 1)); };
  const handleBack = () => { setPlaying(false); setIdx((p) => Math.max(p - 1, -1)); };
  const handleReset = () => resetAll();

  // Current state
  const cur = idx >= 0 ? steps.current[idx] : null;
  const st = idx >= 0 ? simulate(V0.current, steps.current, idx, L, NW) : null;
  const prev = idx > 0 ? simulate(V0.current, steps.current, idx - 1, L, NW) : null;
  const total = V0.current.reduce((a, b) => a + b, 0);

  // Code highlighting
  const highlightTags = (() => {
    if (!cur) return ["bsig", "idx"];
    switch (cur.t) {
      case "warp": return ["warp", "wfor", "wshfl"];
      case "write": return ["write"];
      case "sync": return ["sync"];
      case "load": return ["load"];
      case "warp0": return ["warp0", "wfor", "wshfl"];
      case "ret": return ["ret", "wret"];
    }
  })();

  // Status text
  const statusText = (() => {
    if (!cur) return `Press RUN to launch the kernel — ${L * NW} threads, one value each`;
    switch (cur.t) {
      case "warp": return `warp_reduce_sum · offset ${cur.off} · every warp shuffles in lockstep`;
      case "write": return `lane 0 of each warp publishes its partial sum to shared memory`;
      case "sync": return `__syncthreads() · all ${L * NW} threads wait until every t[warpId] is written`;
      case "load": return `warp 0 reloads: lane < numWarps reads t[lane], others get 0`;
      case "warp0": return `warp_reduce_sum again · offset ${cur.off} · only warp 0 is active`;
      case "ret": return `return val · thread 0 holds the block sum ✓`;
    }
  })();

  // Formula text
  const formulaText = (() => {
    if (!cur || !st) return `waiting for kernel launch · ${L * NW} threads`;
    if (cur.t === "warp" && prev) {
      const a = prev.v[0], b = prev.v[cur.off!], r = st.v[0];
      return `warp 0, lane 0: val += __shfl_down_sync(val, ${cur.off}) = ${a} + ${b} = ${r}`;
    }
    if (cur.t === "write") {
      return Array.from({ length: NW }, (_, w) => `t[${w}] ← ${st.t[w]}`).join("  ·  ");
    }
    if (cur.t === "sync") return `barrier · t[0..${NW - 1}] now visible to the whole block`;
    if (cur.t === "load") return `numWarps = ${NW} · lanes 0..${NW - 1} ← t[lane] · lanes ${NW}..${L - 1} ← 0.0f`;
    if (cur.t === "warp0" && prev) {
      const a = prev.w0![0], b = prev.w0![cur.off!], r = st.w0![0];
      return `lane 0: val += __shfl_down_sync(val, ${cur.off}) = ${a} + ${b} = ${r}`;
    }
    if (cur.t === "ret") return `block_reduce_sum = ${st.w0![0]} · ${Math.log2(L)} + ${Math.log2(L)} shuffle steps instead of ${L * NW - 1} serial adds`;
    return "";
  })();

  // Cell class helper
  const cellClass = (base: string, ...mods: string[]) => {
    return [base, ...mods].filter(Boolean).join(" ");
  };

  const getCellStyle = (role: "active" | "src" | "dst" | "dead" | "written" | "result" | "default") => {
    const base = "w-7 h-7 flex items-center justify-center text-[11px] font-mono font-medium border transition-all duration-150";
    switch (role) {
      case "dst": return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
      case "src": return `${base} bg-[#cfc09e] text-[#2a1c0d] border-[#967f5e]`;
      case "active": return `${base} bg-[#ebe0ca] text-[#2a1c0d] border-[#bfad88]`;
      case "dead": return `${base} bg-white text-[#cbbb98] border-[#ebe0ca]`;
      case "written": return `${base} bg-[#e5d9c0] text-[#2a1c0d] border-[#967f5e]`;
      case "result": return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
      default: return `${base} bg-[#f3eadb] text-[#85704f] border-[#dccfb2]`;
    }
  };

  const smCellStyle = (role: string) => {
    const base = "w-6 h-6 flex items-center justify-center text-[10px] font-mono font-medium border transition-all duration-150";
    switch (role) {
      case "dst": return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
      case "src": return `${base} bg-[#cfc09e] text-[#2a1c0d] border-[#967f5e]`;
      case "written": return `${base} bg-[#e5d9c0] text-[#2a1c0d] border-[#967f5e]`;
      case "active": return `${base} bg-[#ebe0ca] text-[#2a1c0d] border-[#bfad88]`;
      default: return `${base} bg-[#f3eadb] text-[#bfad88] border-[#dccfb2]`;
    }
  };

  // Determine register cell role
  const getRegRole = (w: number, l: number): string => {
    if (!cur) return "active";
    if (cur.t === "warp") {
      if (l < cur.off!) return "dst";
      if (l < cur.off! * 2) return "src";
      return "dead";
    }
    if (l === 0) return cur.t === "write" ? "src" : "active";
    return "dead";
  };

  // Determine shared mem cell role
  const getSmemRole = (i: number): string => {
    if (!cur || i >= NW) return "default";
    if (cur.t === "write") return "dst";
    if (cur.t === "sync") return "written";
    if (cur.t === "load") return "src";
    if (st && st.t[i] != null) return "active";
    return "default";
  };

  // Determine warp0 cell role
  const getW0Role = (l: number): string => {
    if (!cur || !st?.w0) return "default";
    if (cur.t === "load") return l < NW ? "dst" : "active";
    if (cur.t === "warp0") {
      if (l < cur.off!) return "dst";
      if (l < cur.off! * 2) return "src";
      return "dead";
    }
    if (cur.t === "ret") return l === 0 ? "result" : "dead";
    return "default";
  };

  return (
    <div className="space-y-6">
      {/* Pipeline indicator */}
      <div className="flex gap-1 flex-wrap justify-center">
        {PHASES.map((p) => (
          <div
            key={p.key + p.label}
            className={`text-[10px] font-mono tracking-wider uppercase px-3 py-1.5 border transition-all duration-200 ${
              cur?.t === p.key
                ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-semibold"
                : "bg-white text-[#967f5e] border-[#dccfb2]"
            }`}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* CUDA Context Tags */}
      {showTags && (
        <ThreadInfoPanel
          title="CUDA Thread Context"
          variables={(() => {
            const base = [
              { name: "blockDim.x", value: L * NW },
              { name: "warpSize", value: L },
              { name: "numWarps", value: NW },
            ];
            if (!cur) return base;
            if (cur.t === "warp") {
              return [
                ...base,
                { name: "lane", value: "0", highlight: true },
                { name: "warpId", value: "0.." + (NW - 1) },
                { name: "offset", value: cur.off!, highlight: true },
              ];
            }
            if (cur.t === "write") {
              return [
                ...base,
                { name: "lane", value: 0, highlight: true },
                { name: "condition", value: "lane==0" },
              ];
            }
            if (cur.t === "sync") {
              return [
                ...base,
                { name: "barrier", value: "__syncthreads()", highlight: true },
              ];
            }
            if (cur.t === "load") {
              return [
                ...base,
                { name: "warpId", value: 0, highlight: true },
                { name: "condition", value: "warpId==0" },
                { name: "numWarps", value: NW, highlight: true },
              ];
            }
            if (cur.t === "warp0") {
              return [
                ...base,
                { name: "warpId", value: 0, highlight: true },
                { name: "offset", value: cur.off!, highlight: true },
              ];
            }
            return [
              ...base,
              { name: "threadIdx.x", value: 0, highlight: true },
              { name: "result", value: st?.w0?.[0] ?? "—", highlight: true },
            ];
          })()}
        />
      )}

      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        {/* Left: Visualization */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Registers panel */}
          <div className="border border-[#dccfb2] p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#967f5e]">
                Registers · one val per thread
              </span>
              <span className="text-[10px] font-mono text-[#bfad88]">
                blockDim.x = {L * NW} · {NW} warps × {L} lanes
              </span>
            </div>

            {/* Lane headers */}
            <div className="flex items-center gap-1.5 mb-1" style={{ marginLeft: `${L > 16 ? 48 : 56}px` }}>
              {Array.from({ length: L }, (_, l) => (
                <span key={l} className="w-7 text-center text-[9px] text-[#bfad88] font-mono">
                  {l}
                </span>
              ))}
            </div>

            {/* Warp rows */}
            <div className="space-y-1">
              {Array.from({ length: NW }, (_, w) => (
                <div key={w} className="flex items-center gap-1.5">
                  <span
                    className={`w-12 text-right text-[10px] font-mono font-semibold tracking-wider transition-colors ${
                      cur && (cur.t === "warp" || cur.t === "write") ? "text-[#2a1c0d]" : "text-[#bfad88]"
                    }`}
                  >
                    W{w}
                  </span>
                  <div className="flex gap-[2px]">
                    {Array.from({ length: L }, (_, l) => {
                      const val = st ? st.v[w * L + l] : V0.current[w * L + l];
                      const role = getRegRole(w, l);
                      return (
                        <div key={l} className={getCellStyle(role as any)}>
                          {val}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shared memory panel */}
          <div className="border border-[#dccfb2] p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#967f5e]">
                Shared Memory
              </span>
              <span className="text-[10px] font-mono text-[#bfad88]">
                __shared__ float t[32]
              </span>
            </div>
            <div className="flex gap-[2px] flex-wrap">
              {Array.from({ length: 32 }, (_, i) => {
                const val = st ? st.t[i] : null;
                const role = getSmemRole(i);
                return (
                  <div key={i} className={smCellStyle(role)}>
                    {val == null ? "·" : val}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warp 0 second pass */}
          <div className="border border-[#dccfb2] p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#967f5e]">
                Warp 0 · second pass
              </span>
              <span className="text-[10px] font-mono text-[#bfad88]">
                val = (threadIdx.x &lt; numWarps) ? t[lane] : 0.0f
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-12 text-right text-[10px] font-mono font-semibold tracking-wider transition-colors ${
                  st?.w0 ? "text-[#2a1c0d]" : "text-[#bfad88]"
                }`}
              >
                W0
              </span>
              <div className="flex gap-[2px]">
                {Array.from({ length: L }, (_, l) => {
                  const val = st?.w0 ? st.w0[l] : null;
                  const role = getW0Role(l);
                  return (
                    <div key={l} className={getCellStyle(role as any)}>
                      {val == null ? "·" : val}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Result readout */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#dccfb2]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#967f5e]">
                thread 0 returns
              </span>
              <span
                className={`font-heading text-2xl font-bold tracking-tight transition-colors ${
                  cur?.t === "ret" ? "text-[#2a1c0d]" : "text-[#dccfb2]"
                }`}
              >
                {cur?.t === "ret" && st?.w0 ? st.w0[0] : "····"}
              </span>
              {cur?.t === "ret" && (
                <span className="text-[10px] font-mono text-[#967f5e]">
                  Σ of all {L * NW} inputs = {total} ✓
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Code panel */}
        {showCode && (
          <div className="w-full lg:w-[420px] flex-shrink-0">
            <SimulationCodePanel
              lines={CODE_LINES}
              highlightTags={highlightTags}
              filename="block_reduce.cu"
            />
          </div>
        )}
      </div>

      {/* Formula bar */}
      <div className="border border-[#dccfb2] px-4 py-2 text-center text-[13px] font-mono text-[#5e4a30] min-h-[36px]">
        {formulaText}
      </div>

      {/* Controls */}
      <SimulationControls
        isPlaying={playing}
        onPlay={handlePlay}
        onPause={() => setPlaying(false)}
        onStep={handleStep}
        onBack={handleBack}
        onReset={handleReset}
        currentStep={Math.max(0, idx)}
        totalSteps={steps.current.length}
        speed={speed}
        onSpeedChange={setSpeed}
        statusText={statusText}
      >
        <select
          value={L}
          onChange={(e) => setL(Number(e.target.value))}
          className="text-[10px] font-mono px-2 py-1 border border-[#cfc09e] bg-white text-[#5e4a30] cursor-pointer"
        >
          <option value={8}>8 lanes</option>
          <option value={16}>16 lanes</option>
        </select>
        <select
          value={NW}
          onChange={(e) => setNW(Number(e.target.value))}
          className="text-[10px] font-mono px-2 py-1 border border-[#cfc09e] bg-white text-[#5e4a30] cursor-pointer"
        >
          <option value={2}>2 warps</option>
          <option value={4}>4 warps</option>
          <option value={8}>8 warps</option>
        </select>
        <button
          onClick={() => setShowTags(!showTags)}
          className={`text-[10px] font-mono px-2 py-1 border transition-colors ${
            showTags
              ? "border-[#2a1c0d] bg-[#2a1c0d] text-white"
              : "border-[#cfc09e] text-[#5e4a30]"
          }`}
        >
          Tags: {showTags ? "On" : "Off"}
        </button>
        <button
          onClick={() => setShowCode(!showCode)}
          className={`text-[10px] font-mono px-2 py-1 border transition-colors ${
            showCode
              ? "border-[#2a1c0d] bg-[#2a1c0d] text-white"
              : "border-[#cfc09e] text-[#5e4a30]"
          }`}
        >
          Code: {showCode ? "On" : "Off"}
        </button>
      </SimulationControls>
    </div>
  );
}
