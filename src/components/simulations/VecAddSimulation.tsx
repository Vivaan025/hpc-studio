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

const BASIC_CODE: CodeLine[] = [
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("vecadd_basic")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "idx",  html: `    ${TY("int")} i = blockIdx.x * blockDim.x + threadIdx.x;` },
  { tag: "bnd",  html: `    ${K("if")} (i < N) {` },
  { tag: "add",  html: `        C[i] = A[i] + B[i];` },
  { tag: "",     html: `    }` },
  { tag: "",     html: `}` },
];

const STRIDE_CODE: CodeLine[] = [
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("vecadd_stride")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "str",  html: `    ${TY("int")} stride = blockDim.x * gridDim.x;` },
  { tag: "loop", html: `    ${K("for")} (${TY("int")} i = blockIdx.x * blockDim.x + threadIdx.x; i < N; i += stride) {` },
  { tag: "add",  html: `        C[i] = A[i] + B[i];` },
  { tag: "",     html: `    }` },
  { tag: "",     html: `}` },
];

const VEC_N = 16;
const BLOCK_SIZE = 4;

function makeVec(seed: number): number[] {
  return Array.from({ length: VEC_N }, (_, i) => ((i * seed + 3) % 9) + 1);
}

interface VecStep {
  label: string;
  desc: string;
  tags: string[];
  activeThreads: number[]; // global thread indices active this step
  computedIndices: number[]; // which C[i] have been written
  readIndices: number[]; // which A[i], B[i] being read
  iteration?: number; // for stride: which iteration
}

function buildBasicSteps(A: number[], B: number[]): VecStep[] {
  const steps: VecStep[] = [];
  const numBlocks = Math.ceil(VEC_N / BLOCK_SIZE);

  steps.push({
    label: "Launch Kernel",
    desc: `${numBlocks} blocks × ${BLOCK_SIZE} threads = ${numBlocks * BLOCK_SIZE} threads launched. Each thread computes one C[i].`,
    tags: ["sig"], activeThreads: [], computedIndices: [], readIndices: [],
  });

  steps.push({
    label: "Calculate Thread Index",
    desc: `Each thread computes i = blockIdx.x × ${BLOCK_SIZE} + threadIdx.x. Thread 0 → i=0, thread 1 → i=1, etc.`,
    tags: ["idx"], activeThreads: Array.from({ length: VEC_N }, (_, i) => i), computedIndices: [], readIndices: [],
  });

  // Process block by block
  for (let b = 0; b < numBlocks; b++) {
    const start = b * BLOCK_SIZE;
    const end = Math.min(start + BLOCK_SIZE, VEC_N);
    const threads = Array.from({ length: end - start }, (_, i) => start + i);
    const computed = Array.from({ length: end }, (_, i) => i); // cumulative

    steps.push({
      label: `Block ${b}: Read A[${start}..${end - 1}] + B[${start}..${end - 1}]`,
      desc: `${end - start} threads read their corresponding elements from A and B (global memory).`,
      tags: ["bnd", "add"], activeThreads: threads, computedIndices: [],
      readIndices: threads,
    });

    steps.push({
      label: `Block ${b}: Write C[${start}..${end - 1}]`,
      desc: `Each thread writes C[i] = A[i] + B[i]. ${threads.map(i => `C[${i}]=${A[i]}+${B[i]}=${A[i] + B[i]}`).join(", ")}`,
      tags: ["add"], activeThreads: threads, computedIndices: computed,
      readIndices: [],
    });
  }

  return steps;
}

function buildStrideSteps(A: number[], B: number[]): VecStep[] {
  const steps: VecStep[] = [];
  const gridSize = 2; // use 2 blocks
  const totalThreads = gridSize * BLOCK_SIZE; // 8 threads

  steps.push({
    label: "Launch Kernel",
    desc: `${gridSize} blocks × ${BLOCK_SIZE} threads = ${totalThreads} threads. stride = ${totalThreads}. Each thread handles multiple elements.`,
    tags: ["sig", "str"], activeThreads: [], computedIndices: [], readIndices: [],
  });

  const computed: number[] = [];
  const iterations = Math.ceil(VEC_N / totalThreads);

  for (let iter = 0; iter < iterations; iter++) {
    const threads: number[] = [];
    const reads: number[] = [];
    for (let t = 0; t < totalThreads; t++) {
      const i = t + iter * totalThreads;
      if (i < VEC_N) { threads.push(t); reads.push(i); computed.push(i); }
    }

    steps.push({
      label: `Iteration ${iter}: i = tid + ${iter} × ${totalThreads}`,
      desc: `${threads.length} threads compute C[${reads[0]}..${reads[reads.length - 1]}]. Each thread strides by ${totalThreads}.`,
      tags: ["loop", "add"], activeThreads: threads, computedIndices: [...computed],
      readIndices: reads, iteration: iter,
    });
  }

  return steps;
}

interface VecAddSimulationProps {
  approach: string;
}

export default function VecAddSimulation({ approach }: VecAddSimulationProps) {
  const isBasic = approach === "basic";
  const A = useMemo(() => makeVec(7), []);
  const B = useMemo(() => makeVec(3), []);
  const C = useMemo(() => A.map((a, i) => a + B[i]), [A, B]);

  const allSteps = useMemo(
    () => isBasic ? buildBasicSteps(A, B) : buildStrideSteps(A, B),
    [isBasic, A, B]
  );
  const codeLines = isBasic ? BASIC_CODE : STRIDE_CODE;

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
  const computedSet = new Set(cur?.computedIndices || []);
  const readSet = new Set(cur?.readIndices || []);

  const vecCellClass = (i: number, isOutput: boolean) => {
    const base = "w-9 h-9 flex items-center justify-center text-[12px] font-mono border transition-all duration-150";
    if (isOutput && computedSet.has(i)) return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
    if (!isOutput && readSet.has(i)) return `${base} bg-[#41301c] text-white border-[#41301c] font-semibold`;
    return `${base} bg-[#f3eadb] text-[#6a5438] border-[#dccfb2]`;
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
              {cur?.desc || `C[i] = A[i] + B[i] for ${VEC_N} elements`}
            </div>
          </div>

          {/* CUDA Context Tags */}
          {showTags && (
            <ThreadInfoPanel
              title="CUDA Thread Context"
              variables={(() => {
                const numBlocks = isBasic ? Math.ceil(VEC_N / BLOCK_SIZE) : 2;
                const totalThreads = numBlocks * BLOCK_SIZE;
                const base = [
                  { name: "blockDim.x", value: BLOCK_SIZE },
                  { name: "gridDim.x", value: numBlocks },
                ];
                if (!cur || cur.activeThreads.length === 0) return base;
                const t0 = cur.activeThreads[0];
                const bIdx = Math.floor(t0 / BLOCK_SIZE);
                const tIdx = t0 % BLOCK_SIZE;
                const vars = [
                  ...base,
                  { name: "blockIdx.x", value: bIdx, highlight: true },
                  { name: "threadIdx.x", value: tIdx, highlight: true },
                  { name: "i", value: t0, highlight: true },
                ];
                if (!isBasic) {
                  vars.push({ name: "stride", value: totalThreads });
                  if (cur.iteration != null) vars.push({ name: "iteration", value: cur.iteration, highlight: true });
                }
                return vars;
              })()}
            />
          )}

          {/* Vectors */}
          <div className="space-y-3">
            {/* Index header */}
            <div className="flex items-center gap-[1px]" style={{ marginLeft: "28px" }}>
              {Array.from({ length: VEC_N }, (_, i) => (
                <div key={i} className="w-9 text-center text-[9px] font-mono text-[#bfad88]">{i}</div>
              ))}
            </div>

            {/* A */}
            <div className="flex items-center gap-[1px]">
              <span className="w-7 text-right text-[10px] font-mono font-semibold text-[#967f5e]">A</span>
              {A.map((v, i) => (
                <div key={i} className={vecCellClass(i, false)}>{v}</div>
              ))}
            </div>

            {/* + sign */}
            <div className="text-center text-[#bfad88] text-sm font-mono">+</div>

            {/* B */}
            <div className="flex items-center gap-[1px]">
              <span className="w-7 text-right text-[10px] font-mono font-semibold text-[#967f5e]">B</span>
              {B.map((v, i) => (
                <div key={i} className={vecCellClass(i, false)}>{v}</div>
              ))}
            </div>

            {/* = sign */}
            <div className="text-center text-[#bfad88] text-sm font-mono">=</div>

            {/* C */}
            <div className="flex items-center gap-[1px]">
              <span className="w-7 text-right text-[10px] font-mono font-semibold text-[#967f5e]">C</span>
              {C.map((v, i) => (
                <div key={i} className={vecCellClass(i, true)}>
                  {computedSet.has(i) ? v : "·"}
                </div>
              ))}
            </div>
          </div>

          {/* Thread mapping */}
          {cur && cur.activeThreads.length > 0 && (
            <div className="border border-[#dccfb2] p-3">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                Active Threads
              </div>
              <div className="flex gap-[2px] flex-wrap">
                {cur.activeThreads.map((t) => (
                  <div key={t} className="w-6 h-6 flex items-center justify-center text-[10px] font-mono bg-[#2a1c0d] text-white border border-[#2a1c0d]">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showCode && (
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <SimulationCodePanel
              lines={codeLines}
              highlightTags={cur?.tags || ["sig"]}
              filename={isBasic ? "vecadd_basic.cu" : "vecadd_stride.cu"}
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
