"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import SimulationControls from "./SimulationControls";
import SimulationCodePanel from "./SimulationCodePanel";
import ThreadInfoPanel from "./ThreadInfoPanel";

// ── Code ──
const K = (s: string) => `<span style="font-weight:700">${s}</span>`;
const TY = (s: string) => `<span style="color:#5e4a30">${s}</span>`;
const F = (s: string) => `<span style="font-weight:600">${s}</span>`;
const NUM = (s: string) => `<span style="font-weight:600">${s}</span>`;
const CM = (s: string) => `<span style="color:#967f5e;font-style:italic">${s}</span>`;

interface CodeLine { tag: string; html: string }

const NAIVE_CODE: CodeLine[] = [
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("matmul_naive")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "idx",  html: `    ${TY("int")} row = blockIdx.y * blockDim.y + threadIdx.y;` },
  { tag: "idx",  html: `    ${TY("int")} col = blockIdx.x * blockDim.x + threadIdx.x;` },
  { tag: "bnd",  html: `    ${K("if")} (row < N && col < N) {` },
  { tag: "init", html: `        ${TY("float")} sum = ${NUM("0.0f")};` },
  { tag: "loop", html: `        ${K("for")} (${TY("int")} k = ${NUM("0")}; k < N; k++) {` },
  { tag: "mac",  html: `            sum += A[row * N + k] * B[k * N + col];` },
  { tag: "",     html: `        }` },
  { tag: "wr",   html: `        C[row * N + col] = sum;` },
  { tag: "",     html: `    }` },
  { tag: "",     html: `}` },
];

const TILED_CODE: CodeLine[] = [
  { tag: "def",  html: `#define TILE_SIZE ${NUM("4")}` },
  { tag: "",     html: `` },
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("matmul_tiled")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sA[TILE_SIZE][TILE_SIZE];` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sB[TILE_SIZE][TILE_SIZE];` },
  { tag: "idx",  html: `    ${TY("int")} row = blockIdx.y * TILE_SIZE + threadIdx.y;` },
  { tag: "idx",  html: `    ${TY("int")} col = blockIdx.x * TILE_SIZE + threadIdx.x;` },
  { tag: "init", html: `    ${TY("float")} sum = ${NUM("0.0f")};` },
  { tag: "tloop",html: `    ${K("for")} (${TY("int")} t = ${NUM("0")}; t < (N + TILE_SIZE - 1) / TILE_SIZE; t++) {` },
  { tag: "ldA",  html: `        sA[threadIdx.y][threadIdx.x] = A[row * N + t * TILE_SIZE + threadIdx.x];` },
  { tag: "ldB",  html: `        sB[threadIdx.y][threadIdx.x] = B[(t * TILE_SIZE + threadIdx.y) * N + col];` },
  { tag: "sync", html: `        ${F("__syncthreads")}();` },
  { tag: "mac",  html: `        ${K("for")} (${TY("int")} k = ${NUM("0")}; k < TILE_SIZE; k++)` },
  { tag: "mac",  html: `            sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];` },
  { tag: "sync2",html: `        ${F("__syncthreads")}();` },
  { tag: "",     html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (row < N && col < N) C[row * N + col] = sum;` },
  { tag: "",     html: `}` },
];

// ── Data ──
const N = 4; // 4x4 matrices for visualization
const TILE = 4;

function makeMatrix(): number[][] {
  return [
    [2, 0, 1, 3],
    [1, 2, 0, 1],
    [3, 1, 2, 0],
    [0, 3, 1, 2],
  ];
}
function makeMatrixB(): number[][] {
  return [
    [1, 2, 0, 1],
    [0, 1, 3, 2],
    [2, 0, 1, 0],
    [1, 3, 2, 1],
  ];
}

function matmul(A: number[][], B: number[][]): number[][] {
  const C = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

// ── Steps ──
interface NaiveStep {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  row: number;
  col: number;
  k: number; // -1 = not computing, 0..N-1 = which k
  readA?: [number, number]; // [r,c] being read from A
  readB?: [number, number]; // [r,c] being read from B
  writeC?: [number, number]; // [r,c] being written
  product?: number;
  partialSum?: number;
}

function buildNaiveSteps(A: number[][], B: number[][]): NaiveStep[] {
  const r = 0, c = 0; // Focus on thread (0,0) computing C[0][0]
  const steps: NaiveStep[] = [];
  steps.push({
    id: "launch", label: "Launch Kernel", desc: `Grid of ${N}×${N} blocks, 1 thread each. Thread (0,0) computes C[0][0].`,
    tags: ["sig", "idx"], row: r, col: c, k: -1,
  });
  steps.push({
    id: "idx", label: "Calculate Position", desc: `row = blockIdx.y × 1 + 0 = ${r}, col = blockIdx.x × 1 + 0 = ${c}`,
    tags: ["idx", "bnd"], row: r, col: c, k: -1,
  });
  steps.push({
    id: "init", label: "Initialize sum = 0", desc: `Thread (0,0) initializes sum = 0.0f for accumulation.`,
    tags: ["init"], row: r, col: c, k: -1,
  });

  let sum = 0;
  for (let k = 0; k < N; k++) {
    const prod = A[r][k] * B[k][c];
    sum += prod;
    steps.push({
      id: `k${k}`, label: `k=${k}: Load A[${r}][${k}] and B[${k}][${c}]`,
      desc: `Read A[${r}][${k}]=${A[r][k]} from global memory, read B[${k}][${c}]=${B[k][c]} from global memory.`,
      tags: ["loop", "mac"], row: r, col: c, k,
      readA: [r, k], readB: [k, c], product: prod, partialSum: sum,
    });
  }

  steps.push({
    id: "write", label: `Write C[${r}][${c}] = ${sum}`, desc: `Thread (0,0) writes the final dot product to global memory.`,
    tags: ["wr"], row: r, col: c, k: -1, writeC: [r, c],
  });

  return steps;
}

interface TiledStep {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  tile: number; // which tile phase (-1 = none)
  phase: "smem" | "ldA" | "ldB" | "sync" | "compute" | "sync2" | "write" | "init" | "none";
  sA?: number[][]; // current shared A tile
  sB?: number[][]; // current shared B tile
  readACells?: [number, number][]; // cells being loaded
  readBCells?: [number, number][];
  partialSum?: number;
  computeK?: number; // which k within the tile (0..TILE-1)
  computeProduct?: number; // sA[row][k] * sB[k][col]
  computeAVal?: number; // sA[row][k]
  computeBVal?: number; // sB[k][col]
}

function buildTiledSteps(A: number[][], B: number[][]): TiledStep[] {
  const steps: TiledStep[] = [];
  const numTiles = Math.ceil(N / TILE);

  steps.push({
    id: "smem", label: "Declare Shared Memory", desc: `Each block allocates sA[${TILE}][${TILE}] and sB[${TILE}][${TILE}] in on-chip shared memory (~100× faster than global).`,
    tags: ["smem", "sig"], tile: -1, phase: "smem",
  });
  steps.push({
    id: "init", label: "Initialize sum = 0", desc: `Each thread initializes its accumulator.`,
    tags: ["init", "idx"], tile: -1, phase: "init",
  });

  let sum = 0;
  for (let t = 0; t < numTiles; t++) {
    // Load A tile
    const aCells: [number, number][] = [];
    const sA = Array.from({ length: TILE }, () => Array(TILE).fill(0));
    for (let r = 0; r < TILE; r++)
      for (let c = 0; c < TILE; c++) {
        const gc = t * TILE + c;
        if (r < N && gc < N) { sA[r][c] = A[r][gc]; aCells.push([r, gc]); }
      }

    steps.push({
      id: `ldA${t}`, label: `Tile ${t}: Load A → sA`, desc: `All ${TILE * TILE} threads cooperatively load a ${TILE}×${TILE} tile of A from global into shared memory. Each thread loads 1 element.`,
      tags: ["ldA", "tloop"], tile: t, phase: "ldA", readACells: aCells, sA,
    });

    // Load B tile
    const bCells: [number, number][] = [];
    const sB = Array.from({ length: TILE }, () => Array(TILE).fill(0));
    for (let r = 0; r < TILE; r++)
      for (let c = 0; c < TILE; c++) {
        const gr = t * TILE + r;
        if (gr < N && c < N) { sB[r][c] = B[gr][c]; bCells.push([gr, c]); }
      }

    steps.push({
      id: `ldB${t}`, label: `Tile ${t}: Load B → sB`, desc: `Load the corresponding ${TILE}×${TILE} tile of B into sB. Coalesced access — consecutive threads load consecutive columns.`,
      tags: ["ldB", "tloop"], tile: t, phase: "ldB", readBCells: bCells, sB, sA,
    });

    steps.push({
      id: `sync${t}`, label: `__syncthreads()`, desc: `CRITICAL: All threads in the block must reach this barrier. Ensures the entire tile is loaded before any thread computes.`,
      tags: ["sync"], tile: t, phase: "sync", sA, sB,
    });

    // Compute — one step per k so beginners can trace every multiply-accumulate
    for (let k = 0; k < TILE; k++) {
      const gk = t * TILE + k;
      const aVal = gk < N ? sA[0][k] : 0;
      const bVal = gk < N ? sB[k][0] : 0;
      const prod = aVal * bVal;
      if (gk < N) sum += A[0][gk] * B[gk][0];

      steps.push({
        id: `comp${t}_k${k}`, label: `Tile ${t}, k=${k}: sA[0][${k}] × sB[${k}][0]`,
        desc: `Read sA[0][${k}]=${aVal} and sB[${k}][0]=${bVal} from shared memory (fast!). Product = ${aVal}×${bVal} = ${prod}. Running sum = ${sum}.`,
        tags: ["mac"], tile: t, phase: "compute", sA, sB,
        partialSum: sum, computeK: k, computeProduct: prod,
        computeAVal: aVal, computeBVal: bVal,
      });
    }

    steps.push({
      id: `sync2_${t}`, label: `__syncthreads()`, desc: `Second barrier before loading next tile — prevents overwriting shared memory before all threads finish reading.`,
      tags: ["sync2"], tile: t, phase: "sync2", sA, sB,
    });
  }

  steps.push({
    id: "write", label: `Write C[0][0] = ${sum}`, desc: `After all tiles processed, write accumulated sum to C. Key insight: reduced global reads from 2N to 2N/TILE per element!`,
    tags: ["wr"], tile: -1, phase: "write", partialSum: sum,
  });

  return steps;
}

// ── Component ──
interface MatmulSimulationProps {
  approach: string;
}

export default function MatmulSimulation({ approach }: MatmulSimulationProps) {
  const A = useMemo(() => makeMatrix(), []);
  const B = useMemo(() => makeMatrixB(), []);
  const C = useMemo(() => matmul(A, B), [A, B]);

  const isNaive = approach === "naive";
  const naiveSteps = useMemo(() => buildNaiveSteps(A, B), [A, B]);
  const tiledSteps = useMemo(() => buildTiledSteps(A, B), [A, B]);
  const allSteps = isNaive ? naiveSteps : tiledSteps;
  const codeLines = isNaive ? NAIVE_CODE : TILED_CODE;

  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [showCode, setShowCode] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when approach changes
  useEffect(() => { setIdx(-1); setPlaying(false); }, [approach]);

  const delay = () => 1800 - speed * 150;

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
    timerRef.current = setInterval(tick, delay());
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, allSteps.length, idx]);

  const handlePlay = () => {
    if (idx >= allSteps.length - 1) setIdx(-1);
    setPlaying(true);
  };

  const cur = idx >= 0 ? allSteps[idx] : null;
  const tags = cur ? ("tags" in cur ? cur.tags : []) : ["sig"];

  // ── Matrix cell rendering ──
  const matCell = (val: number, highlighted: boolean, isWrite: boolean) => {
    const base = "w-9 h-9 flex items-center justify-center text-[12px] font-mono border transition-all duration-150";
    if (isWrite) return `${base} bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold`;
    if (highlighted) return `${base} bg-[#41301c] text-white border-[#41301c] font-semibold`;
    return `${base} bg-[#f3eadb] text-[#6a5438] border-[#dccfb2]`;
  };

  // Determine which cells are highlighted
  const nStep = isNaive && cur ? cur as NaiveStep : null;
  const tStep = !isNaive && cur ? cur as TiledStep : null;

  return (
    <div className="space-y-5">
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        {/* Left: Matrices */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Step description */}
          <div className="border border-[#dccfb2] p-3">
            <div className="text-xs font-mono text-[#967f5e] mb-1">
              {cur ? `step ${idx + 1}/${allSteps.length}` : "ready"}
            </div>
            <div className="text-sm font-semibold text-[#2a1c0d] mb-1">
              {cur ? ("label" in cur ? cur.label : "") : "Press RUN to start"}
            </div>
            <div className="text-xs text-[#5e4a30] leading-relaxed">
              {cur ? ("desc" in cur ? cur.desc : "") : `${N}×${N} matrix multiply: C = A × B`}
            </div>
          </div>

          {/* CUDA Context Tags */}
          {showTags && (
            <ThreadInfoPanel
              title="CUDA Thread Context"
              variables={(() => {
                if (isNaive) {
                  const base = [
                    { name: "blockDim", value: `(1, 1)` },
                    { name: "gridDim", value: `(${N}, ${N})` },
                  ];
                  if (!nStep) return base;
                  return [
                    ...base,
                    { name: "blockIdx", value: `(${nStep.col}, ${nStep.row})`, highlight: true },
                    { name: "threadIdx", value: `(0, 0)` },
                    { name: "row", value: nStep.row, highlight: true },
                    { name: "col", value: nStep.col, highlight: true },
                    ...(nStep.k >= 0 ? [{ name: "k", value: nStep.k, highlight: true }] : []),
                    ...(nStep.partialSum != null ? [{ name: "sum", value: nStep.partialSum, highlight: true }] : []),
                  ];
                }
                // Tiled
                const base = [
                  { name: "TILE_SIZE", value: 4 },
                  { name: "blockDim", value: `(${N}, ${N})` },
                  { name: "gridDim", value: `(1, 1)` },
                ];
                if (!tStep) return base;
                return [
                  ...base,
                  { name: "blockIdx", value: `(0, 0)` },
                  ...(tStep.tile >= 0 ? [{ name: "tile", value: tStep.tile, highlight: true }] : []),
                  { name: "phase", value: tStep.phase, highlight: true },
                  ...(tStep.partialSum != null ? [{ name: "sum", value: tStep.partialSum, highlight: true }] : []),
                ];
              })()}
            />
          )}

          {/* Matrix grids */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Matrix A */}
            <div>
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">Matrix A</div>
              <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 36px)` }}>
                {A.flatMap((row, r) =>
                  row.map((val, c) => {
                    const hl = nStep?.readA ? nStep.readA[0] === r && nStep.readA[1] === c : false;
                    const hlTile = tStep?.readACells?.some(([tr, tc]) => tr === r && tc === c) || false;
                    return (
                      <div key={`a${r}${c}`} className={matCell(val, hl || hlTile, false)}>
                        {val}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <span className="text-[#bfad88] text-lg font-light">×</span>

            {/* Matrix B */}
            <div>
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">Matrix B</div>
              <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 36px)` }}>
                {B.flatMap((row, r) =>
                  row.map((val, c) => {
                    const hl = nStep?.readB ? nStep.readB[0] === r && nStep.readB[1] === c : false;
                    const hlTile = tStep?.readBCells?.some(([tr, tc]) => tr === r && tc === c) || false;
                    return (
                      <div key={`b${r}${c}`} className={matCell(val, hl || hlTile, false)}>
                        {val}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <span className="text-[#bfad88] text-lg font-light">=</span>

            {/* Matrix C */}
            <div>
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">Matrix C</div>
              <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 36px)` }}>
                {C.flatMap((row, r) =>
                  row.map((val, c) => {
                    const isW = nStep?.writeC ? nStep.writeC[0] === r && nStep.writeC[1] === c : false;
                    const isWt = tStep?.phase === "write" && r === 0 && c === 0;
                    const show = isW || isWt || (idx >= allSteps.length - 1);
                    return (
                      <div key={`c${r}${c}`} className={matCell(val, false, isW || isWt)}>
                        {show ? val : "·"}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Shared memory (tiled only) */}
          {!isNaive && (tStep?.sA || tStep?.sB) && (
            <div className="border border-[#dccfb2] p-3">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                Shared Memory (on-chip SRAM)
              </div>
              <div className="flex gap-6">
                {tStep?.sA && (
                  <div>
                    <div className="text-[9px] font-mono text-[#bfad88] mb-1">sA[{TILE}][{TILE}]</div>
                    <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${TILE}, 28px)` }}>
                      {tStep.sA.flatMap((row, r) =>
                        row.map((val, c) => {
                          const isActiveA = tStep.phase === "compute" && tStep.computeK != null && r === 0 && c === tStep.computeK;
                          return (
                            <div key={`sa${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border transition-all duration-150 ${
                              isActiveA
                                ? "border-[#2a1c0d] bg-[#2a1c0d] text-white font-bold"
                                : "border-[#cfc09e] bg-[#ebe0ca] text-[#5e4a30]"
                            }`}>
                              {val}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
                {tStep?.sB && (
                  <div>
                    <div className="text-[9px] font-mono text-[#bfad88] mb-1">sB[{TILE}][{TILE}]</div>
                    <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${TILE}, 28px)` }}>
                      {tStep.sB.flatMap((row, r) =>
                        row.map((val, c) => {
                          const isActiveB = tStep.phase === "compute" && tStep.computeK != null && r === tStep.computeK && c === 0;
                          return (
                            <div key={`sb${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border transition-all duration-150 ${
                              isActiveB
                                ? "border-[#2a1c0d] bg-[#2a1c0d] text-white font-bold"
                                : "border-[#cfc09e] bg-[#ebe0ca] text-[#5e4a30]"
                            }`}>
                              {val}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Computation trace (naive) — detailed per-k */}
          {isNaive && nStep && nStep.k >= 0 && (
            <div className="border border-[#dccfb2] p-3 space-y-1">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">
                Dot Product · Thread (0,0) → C[0][0]
              </div>
              {Array.from({ length: nStep.k + 1 }, (_, k) => {
                const prod = A[0][k] * B[k][0];
                const pSum = Array.from({ length: k + 1 }, (_, j) => A[0][j] * B[j][0]).reduce((a, b) => a + b, 0);
                const isCurrent = k === nStep.k;
                return (
                  <div key={k} className={`font-mono text-[12px] ${isCurrent ? "text-[#2a1c0d] font-semibold" : "text-[#967f5e]"}`}>
                    <span>k={k}: </span>
                    <span>A[0][{k}]×B[{k}][0] = {A[0][k]}×{B[k][0]} = {prod}</span>
                    <span className={isCurrent ? "font-bold" : ""}> → sum = {pSum}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Computation trace (tiled) — detailed per-k */}
          {!isNaive && tStep?.phase === "compute" && tStep.computeK != null && (
            <div className="border border-[#dccfb2] p-3 space-y-1">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">
                Dot Product · Tile {tStep.tile} · From Shared Memory (fast!)
              </div>
              {Array.from({ length: tStep.computeK + 1 }, (_, k) => {
                const aV = tStep.sA![0][k];
                const bV = tStep.sB![k][0];
                const p = aV * bV;
                // Compute running sum up to this k within this tile
                const tileBase = Array.from({ length: tStep.tile }, (_, t2) => {
                  let s = 0;
                  for (let kk = 0; kk < TILE; kk++) {
                    const gk = t2 * TILE + kk;
                    if (gk < N) s += A[0][gk] * B[gk][0];
                  }
                  return s;
                }).reduce((a, b) => a + b, 0);
                const runSum = tileBase + Array.from({ length: k + 1 }, (_, kk) => tStep.sA![0][kk] * tStep.sB![kk][0]).reduce((a, b) => a + b, 0);
                const isCurrent = k === tStep.computeK;
                return (
                  <div key={k} className={`font-mono text-[12px] ${isCurrent ? "text-[#2a1c0d] font-semibold" : "text-[#967f5e]"}`}>
                    <span>k={k}: </span>
                    <span>sA[0][{k}]×sB[{k}][0] = {aV}×{bV} = {p}</span>
                    <span className={isCurrent ? "font-bold" : ""}> → sum = {runSum}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Code */}
        {showCode && (
          <div className="w-full lg:w-[400px] flex-shrink-0">
            <SimulationCodePanel
              lines={codeLines}
              highlightTags={tags}
              filename={isNaive ? "matmul_naive.cu" : "matmul_tiled.cu"}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <SimulationControls
        isPlaying={playing}
        onPlay={handlePlay}
        onPause={() => setPlaying(false)}
        onStep={() => { setPlaying(false); setIdx((p) => Math.min(p + 1, allSteps.length - 1)); }}
        onBack={() => { setPlaying(false); setIdx((p) => Math.max(p - 1, -1)); }}
        onReset={() => { setPlaying(false); setIdx(-1); }}
        currentStep={Math.max(0, idx)}
        totalSteps={allSteps.length}
        speed={speed}
        onSpeedChange={setSpeed}
        statusText={cur ? ("label" in cur ? cur.label : "") : `Press RUN to start the ${isNaive ? "naive" : "tiled"} matmul kernel`}
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
