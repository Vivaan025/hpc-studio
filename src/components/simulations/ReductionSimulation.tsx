"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import SimulationControls from "./SimulationControls";
import SimulationCodePanel from "./SimulationCodePanel";
import ThreadInfoPanel from "./ThreadInfoPanel";

const K = (s: string) => `<span style="font-weight:700">${s}</span>`;
const TY = (s: string) => `<span style="color:#5e4a30">${s}</span>`;
const F = (s: string) => `<span style="font-weight:600">${s}</span>`;
const NUM = (s: string) => `<span style="font-weight:600">${s}</span>`;
const CM = (s: string) => `<span style="color:#967f5e;font-style:italic">${s}</span>`;

interface CodeLine { tag: string; html: string }

const INTERLEAVED_CODE: CodeLine[] = [
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("reduce_interleaved")}(${TY("float")}* input, ${TY("float")}* output, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("extern")} ${K("__shared__")} ${TY("float")} sdata[];` },
  { tag: "idx",  html: `    ${TY("int")} tid = threadIdx.x;` },
  { tag: "ld",   html: `    sdata[tid] = input[blockIdx.x * blockDim.x + tid];` },
  { tag: "sync", html: `    ${F("__syncthreads")}();` },
  { tag: "loop", html: `    ${K("for")} (${TY("int")} s = ${NUM("1")}; s < blockDim.x; s *= ${NUM("2")}) {` },
  { tag: "div",  html: `        ${K("if")} (tid % (${NUM("2")} * s) == ${NUM("0")}) {` },
  { tag: "add",  html: `            sdata[tid] += sdata[tid + s];` },
  { tag: "",     html: `        }` },
  { tag: "sync2",html: `        ${F("__syncthreads")}();` },
  { tag: "",     html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (tid == ${NUM("0")}) output[blockIdx.x] = sdata[${NUM("0")}];` },
  { tag: "",     html: `}` },
];

const SEQUENTIAL_CODE: CodeLine[] = [
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("reduce_sequential")}(${TY("float")}* input, ${TY("float")}* output, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("extern")} ${K("__shared__")} ${TY("float")} sdata[];` },
  { tag: "idx",  html: `    ${TY("int")} tid = threadIdx.x;` },
  { tag: "ld",   html: `    sdata[tid] = input[blockIdx.x * blockDim.x + tid];` },
  { tag: "sync", html: `    ${F("__syncthreads")}();` },
  { tag: "loop", html: `    ${K("for")} (${TY("int")} s = blockDim.x / ${NUM("2")}; s > ${NUM("0")}; s >>= ${NUM("1")}) {` },
  { tag: "cond", html: `        ${K("if")} (tid < s) {` },
  { tag: "add",  html: `            sdata[tid] += sdata[tid + s];` },
  { tag: "",     html: `        }` },
  { tag: "sync2",html: `        ${F("__syncthreads")}();` },
  { tag: "",     html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (tid == ${NUM("0")}) output[blockIdx.x] = sdata[${NUM("0")}];` },
  { tag: "",     html: `}` },
];

const WARP_CODE: CodeLine[] = [
  { tag: "wfn",  html: `${K("__device__")} ${TY("float")} ${F("warpReduce")}(${TY("float")} val) {` },
  { tag: "wlp",  html: `    ${K("for")} (${TY("int")} off = warpSize/${NUM("2")}; off > ${NUM("0")}; off >>= ${NUM("1")})` },
  { tag: "wsh",  html: `        val += ${F("__shfl_down_sync")}(${NUM("0xffffffff")}, val, off);` },
  { tag: "wret", html: `    ${K("return")} val;` },
  { tag: "",     html: `}` },
  { tag: "",     html: `` },
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("reduce_warp")}(${TY("float")}* in, ${TY("float")}* out, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("extern")} ${K("__shared__")} ${TY("float")} sdata[];` },
  { tag: "idx",  html: `    ${TY("int")} tid = threadIdx.x;` },
  { tag: "ld",   html: `    ${TY("float")} val = in[blockIdx.x * blockDim.x + tid];` },
  { tag: "warp", html: `    val = ${F("warpReduce")}(val);         ${CM("// intra-warp")}` },
  { tag: "lz",   html: `    ${K("if")} (tid % warpSize == ${NUM("0")}) sdata[tid/warpSize] = val;` },
  { tag: "sync", html: `    ${F("__syncthreads")}();` },
  { tag: "fin",  html: `    ${K("if")} (tid < blockDim.x/warpSize) {` },
  { tag: "fin",  html: `        val = sdata[tid];` },
  { tag: "fin",  html: `        val = ${F("warpReduce")}(val);     ${CM("// final")}` },
  { tag: "",     html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (tid == ${NUM("0")}) out[blockIdx.x] = val;` },
  { tag: "",     html: `}` },
];

const BLOCK_SIZE = 8;

function makeData(): number[] {
  return [3, 7, 1, 4, 5, 2, 8, 6];
}

// ── Step types ──
interface RedStep {
  label: string;
  desc: string;
  tags: string[];
  sdata: number[];
  activeThreads: number[]; // threads doing work
  srcIndices: number[]; // sdata indices being read (source)
  dstIndices: number[]; // sdata indices being written (destination)
  divergentThreads?: number[]; // threads that are idle due to divergence
}

function buildInterleavedSteps(data: number[]): RedStep[] {
  const steps: RedStep[] = [];
  const sdata = [...data];

  steps.push({
    label: "Load to Shared Memory",
    desc: `Each thread loads input[tid] into sdata[tid]. All ${BLOCK_SIZE} elements now in fast shared memory.`,
    tags: ["ld", "smem", "sync"], sdata: [...sdata],
    activeThreads: Array.from({ length: BLOCK_SIZE }, (_, i) => i),
    srcIndices: [], dstIndices: [],
  });

  for (let s = 1; s < BLOCK_SIZE; s *= 2) {
    const active: number[] = [];
    const divergent: number[] = [];
    const src: number[] = [];
    const dst: number[] = [];

    for (let t = 0; t < BLOCK_SIZE; t++) {
      if (t % (2 * s) === 0) {
        sdata[t] += sdata[t + s];
        active.push(t);
        dst.push(t);
        src.push(t + s);
      } else {
        divergent.push(t);
      }
    }

    steps.push({
      label: `s=${s}: Interleaved reduction`,
      desc: `Threads where tid%(2×${s})==0 add sdata[tid+${s}]. ${active.length} active, ${divergent.length} divergent (wasted).`,
      tags: ["loop", "div", "add", "sync2"], sdata: [...sdata],
      activeThreads: active, srcIndices: src, dstIndices: dst,
      divergentThreads: divergent,
    });
  }

  steps.push({
    label: `Result: sdata[0] = ${sdata[0]}`,
    desc: `Thread 0 writes the block sum to output. Sum = ${sdata[0]}.`,
    tags: ["wr"], sdata: [...sdata],
    activeThreads: [0], srcIndices: [], dstIndices: [0],
  });

  return steps;
}

function buildSequentialSteps(data: number[]): RedStep[] {
  const steps: RedStep[] = [];
  const sdata = [...data];

  steps.push({
    label: "Load to Shared Memory",
    desc: `Each thread loads input[tid] into sdata[tid].`,
    tags: ["ld", "smem", "sync"], sdata: [...sdata],
    activeThreads: Array.from({ length: BLOCK_SIZE }, (_, i) => i),
    srcIndices: [], dstIndices: [],
  });

  for (let s = BLOCK_SIZE / 2; s > 0; s >>= 1) {
    const active: number[] = [];
    const src: number[] = [];
    const dst: number[] = [];

    for (let t = 0; t < s; t++) {
      sdata[t] += sdata[t + s];
      active.push(t);
      dst.push(t);
      src.push(t + s);
    }

    steps.push({
      label: `s=${s}: Sequential reduction`,
      desc: `Threads 0..${s - 1} add sdata[tid+${s}]. ${active.length} active, no warp divergence — consecutive threads.`,
      tags: ["loop", "cond", "add", "sync2"], sdata: [...sdata],
      activeThreads: active, srcIndices: src, dstIndices: dst,
    });
  }

  steps.push({
    label: `Result: sdata[0] = ${sdata[0]}`,
    desc: `Thread 0 writes the block sum. Sequential addressing eliminates warp divergence entirely.`,
    tags: ["wr"], sdata: [...sdata],
    activeThreads: [0], srcIndices: [], dstIndices: [0],
  });

  return steps;
}

function buildWarpShuffleSteps(data: number[]): RedStep[] {
  const steps: RedStep[] = [];
  const vals = [...data];

  steps.push({
    label: "Load to Registers",
    desc: `Each thread loads input[tid] into a register — no shared memory needed for intra-warp reduction.`,
    tags: ["ld", "idx"], sdata: [...vals],
    activeThreads: Array.from({ length: BLOCK_SIZE }, (_, i) => i),
    srcIndices: [], dstIndices: [],
  });

  // Warp reduce (pretend warpSize = 8 for demo)
  for (let off = BLOCK_SIZE / 2; off > 0; off >>= 1) {
    const src: number[] = [];
    const dst: number[] = [];
    for (let t = 0; t < off; t++) {
      vals[t] += vals[t + off];
      dst.push(t);
      src.push(t + off);
    }

    steps.push({
      label: `__shfl_down offset=${off}`,
      desc: `Warp shuffle: thread t reads value from thread t+${off} via register — no shared memory, no __syncthreads. ${off} active lanes.`,
      tags: ["warp", "wlp", "wsh"], sdata: [...vals],
      activeThreads: Array.from({ length: off }, (_, i) => i),
      srcIndices: src, dstIndices: dst,
    });
  }

  steps.push({
    label: `Result: thread 0 val = ${vals[0]}`,
    desc: `Thread 0 holds the sum. Warp shuffle avoids shared memory entirely for the final reduction — zero bank conflicts, zero synchronization overhead.`,
    tags: ["wr", "wret"], sdata: [...vals],
    activeThreads: [0], srcIndices: [], dstIndices: [0],
  });

  return steps;
}

interface ReductionSimulationProps {
  approach: string;
}

export default function ReductionSimulation({ approach }: ReductionSimulationProps) {
  const data = useMemo(() => makeData(), []);
  const total = useMemo(() => data.reduce((a, b) => a + b, 0), [data]);

  const allSteps = useMemo(() => {
    if (approach === "naive") return buildInterleavedSteps(data);
    if (approach === "sequential") return buildSequentialSteps(data);
    return buildWarpShuffleSteps(data);
  }, [approach, data]);

  const codeLines = approach === "naive" ? INTERLEAVED_CODE : approach === "sequential" ? SEQUENTIAL_CODE : WARP_CODE;

  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [showCode, setShowCode] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setIdx(-1); setPlaying(false); }, [approach]);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    const tick = () => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next >= allSteps.length) { setPlaying(false); return prev; }
        return next;
      });
    };
    if (idx < 0) setIdx(0);
    timerRef.current = setInterval(tick, 1800 - speed * 150);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, allSteps.length, idx]);

  const cur = idx >= 0 ? allSteps[idx] : null;
  const srcSet = new Set(cur?.srcIndices || []);
  const dstSet = new Set(cur?.dstIndices || []);
  const activeSet = new Set(cur?.activeThreads || []);
  const divergentSet = new Set(cur?.divergentThreads || []);

  const cellClass = (i: number) => {
    const base = "w-10 h-10 flex flex-col items-center justify-center text-[12px] font-mono border transition-all duration-150";
    if (dstSet.has(i)) return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
    if (srcSet.has(i)) return `${base} bg-[#cfc09e] text-[#2a1c0d] border-[#967f5e]`;
    if (activeSet.has(i)) return `${base} bg-[#ebe0ca] text-[#2a1c0d] border-[#bfad88]`;
    if (divergentSet.has(i)) return `${base} bg-white text-[#cbbb98] border-[#ebe0ca]`;
    return `${base} bg-[#f3eadb] text-[#85704f] border-[#dccfb2]`;
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Step info */}
          <div className="border border-[#dccfb2] p-3">
            <div className="text-xs font-mono text-[#967f5e] mb-1">
              {cur ? `step ${idx + 1}/${allSteps.length}` : "ready"}
            </div>
            <div className="text-sm font-semibold text-[#2a1c0d] mb-1">
              {cur?.label || "Press RUN to start"}
            </div>
            <div className="text-xs text-[#5e4a30] leading-relaxed">
              {cur?.desc || `Reduce ${BLOCK_SIZE} values to a single sum = ${total}`}
            </div>
          </div>

          {/* CUDA Context Tags */}
          {showTags && (
            <ThreadInfoPanel
              title="CUDA Thread Context"
              variables={(() => {
                const base = [
                  { name: "blockDim.x", value: BLOCK_SIZE },
                  { name: "blockIdx.x", value: 0 },
                ];
                if (!cur) return base;
                if (approach === "naive") {
                  const sVal = cur.label.match(/s=(\d+)/)?.[1];
                  return [
                    ...base,
                    { name: "tid", value: cur.activeThreads[0] ?? "—", highlight: cur.activeThreads.length > 0 },
                    ...(sVal ? [{ name: "s", value: sVal, highlight: true }] : []),
                    ...(sVal ? [{ name: "tid%(2*s)", value: `${(cur.activeThreads[0] ?? 0)}%${2 * Number(sVal)}`, dim: true }] : []),
                  ];
                }
                if (approach === "sequential") {
                  const sVal = cur.label.match(/s=(\d+)/)?.[1];
                  return [
                    ...base,
                    { name: "tid", value: cur.activeThreads[0] ?? "—", highlight: cur.activeThreads.length > 0 },
                    ...(sVal ? [{ name: "s", value: sVal, highlight: true }] : []),
                    ...(sVal ? [{ name: "tid<s", value: (cur.activeThreads[0] ?? 0) < Number(sVal) ? "true" : "false" }] : []),
                  ];
                }
                // warp-shuffle
                const offVal = cur.label.match(/offset=(\d+)/)?.[1];
                return [
                  ...base,
                  { name: "tid", value: cur.activeThreads[0] ?? "—", highlight: cur.activeThreads.length > 0 },
                  { name: "warpSize", value: BLOCK_SIZE },
                  ...(offVal ? [{ name: "offset", value: offVal, highlight: true }] : []),
                ];
              })()}
            />
          )}

          {/* Thread index header */}
          <div>
            <div className="flex gap-[2px] mb-1" style={{ marginLeft: "52px" }}>
              {Array.from({ length: BLOCK_SIZE }, (_, i) => (
                <div key={i} className="w-10 text-center text-[9px] font-mono text-[#bfad88]">
                  tid={i}
                </div>
              ))}
            </div>

            {/* Data array */}
            <div className="flex items-center gap-[2px]">
              <span className="w-12 text-right text-[10px] font-mono text-[#967f5e] pr-1">
                {approach === "warp-shuffle" ? "regs" : "sdata"}
              </span>
              {(cur?.sdata || data).map((val, i) => (
                <div key={i} className={cellClass(i)}>
                  <span>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[10px] font-mono text-[#967f5e]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-[#2a1c0d] border border-[#2a1c0d]" /> destination
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-[#cfc09e] border border-[#967f5e]" /> source
            </span>
            {approach === "naive" && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-white border border-[#ebe0ca]" /> divergent (wasted)
              </span>
            )}
          </div>

          {/* Result */}
          <div className="border border-[#dccfb2] p-3 flex items-center gap-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#967f5e]">
              Block Sum
            </span>
            <span className={`font-heading text-xl font-bold transition-colors ${
              idx >= allSteps.length - 1 ? "text-[#2a1c0d]" : "text-[#dccfb2]"
            }`}>
              {idx >= allSteps.length - 1 ? cur?.sdata[0] : "····"}
            </span>
            {idx >= allSteps.length - 1 && (
              <span className="text-[10px] font-mono text-[#967f5e]">
                = {data.join(" + ")} ✓
              </span>
            )}
          </div>
        </div>

        {showCode && (
          <div className="w-full lg:w-[400px] flex-shrink-0">
            <SimulationCodePanel
              lines={codeLines}
              highlightTags={cur?.tags || ["sig"]}
              filename={
                approach === "naive" ? "reduce_interleaved.cu" :
                approach === "sequential" ? "reduce_sequential.cu" : "reduce_warp.cu"
              }
            />
          </div>
        )}
      </div>

      <SimulationControls
        isPlaying={playing}
        onPlay={() => { if (idx >= allSteps.length - 1) setIdx(-1); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onStep={() => { setPlaying(false); setIdx((p) => Math.min(p + 1, allSteps.length - 1)); }}
        onBack={() => { setPlaying(false); setIdx((p) => Math.max(p - 1, -1)); }}
        onReset={() => { setPlaying(false); setIdx(-1); }}
        currentStep={Math.max(0, idx)}
        totalSteps={allSteps.length}
        speed={speed}
        onSpeedChange={setSpeed}
        statusText={cur?.label || "Press RUN to start"}
      >
        <button
          onClick={() => setShowTags(!showTags)}
          className={`text-[10px] font-mono px-2 py-1 border transition-colors ${
            showTags ? "border-[#2a1c0d] bg-[#2a1c0d] text-white" : "border-[#cfc09e] text-[#5e4a30]"
          }`}
        >
          Tags: {showTags ? "On" : "Off"}
        </button>
        <button
          onClick={() => setShowCode(!showCode)}
          className={`text-[10px] font-mono px-2 py-1 border transition-colors ${
            showCode ? "border-[#2a1c0d] bg-[#2a1c0d] text-white" : "border-[#cfc09e] text-[#5e4a30]"
          }`}
        >
          Code: {showCode ? "On" : "Off"}
        </button>
      </SimulationControls>
    </div>
  );
}
