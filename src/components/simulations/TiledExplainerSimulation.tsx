"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import SimulationControls from "./SimulationControls";
import SimulationCodePanel from "./SimulationCodePanel";
import ThreadInfoPanel from "./ThreadInfoPanel";

// ── Syntax helpers ──
const K = (s: string) => `<span style="font-weight:700">${s}</span>`;
const TY = (s: string) => `<span style="color:#5e4a30">${s}</span>`;
const F = (s: string) => `<span style="font-weight:600">${s}</span>`;
const NUM = (s: string) => `<span style="font-weight:600">${s}</span>`;

const CODE_LINES = [
  { tag: "def",  html: `${K("#define")} TILE_SIZE ${NUM("4")}` },
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("matmul_tiled")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sA[TILE_SIZE][TILE_SIZE];` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sB[TILE_SIZE][TILE_SIZE];` },
  { tag: "idx",  html: `    ${TY("int")} row = blockIdx.y * TILE_SIZE + threadIdx.y;` },
  { tag: "idx",  html: `    ${TY("int")} col = blockIdx.x * TILE_SIZE + threadIdx.x;` },
  { tag: "init", html: `    ${TY("float")} sum = ${NUM("0.0f")};` },
  { tag: "tloop",html: `    ${K("for")} (${TY("int")} t = ${NUM("0")}; t < (N+TILE_SIZE-${NUM("1")})/TILE_SIZE; t++) {` },
  { tag: "ldA",  html: `        sA[threadIdx.y][threadIdx.x] = A[row * N + t*TILE_SIZE + threadIdx.x];` },
  { tag: "ldB",  html: `        sB[threadIdx.y][threadIdx.x] = B[(t*TILE_SIZE + threadIdx.y)*N + col];` },
  { tag: "sync1",html: `        ${K("__syncthreads")}(); ${K("// barrier 1: wait for tile load")}` },
  { tag: "mac",  html: `        ${K("for")} (${TY("int")} k = ${NUM("0")}; k < TILE_SIZE; k++)` },
  { tag: "mac",  html: `            sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];` },
  { tag: "sync2",html: `        ${K("__syncthreads")}(); ${K("// barrier 2: before next tile")}` },
  { tag: "tloop",html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (row < N && col < N) C[row * N + col] = sum;` },
  { tag: "sig",  html: `}` },
];

// ─── Constants ───────────────────────────────────────────────────────────────
const T = 4; // TILE_SIZE
const N = 8; // Matrix size (8×8 for the big picture, 4×4 for detail)

// ─── Matrix data (fixed for reproducibility) ─────────────────────────────────
function makeA(): number[][] {
  return [
    [2, 0, 1, 3, 1, 0, 2, 1],
    [1, 2, 0, 1, 3, 1, 0, 2],
    [3, 1, 2, 0, 0, 3, 1, 1],
    [0, 3, 1, 2, 2, 0, 3, 0],
    [1, 1, 3, 0, 2, 1, 0, 3],
    [2, 0, 0, 3, 1, 2, 1, 0],
    [0, 2, 1, 1, 3, 0, 2, 1],
    [1, 3, 2, 0, 0, 1, 3, 2],
  ];
}
function makeB(): number[][] {
  return [
    [1, 2, 0, 1, 3, 0, 1, 2],
    [0, 1, 3, 2, 1, 2, 0, 1],
    [2, 0, 1, 0, 2, 1, 3, 0],
    [1, 3, 2, 1, 0, 3, 2, 1],
    [0, 1, 1, 3, 2, 0, 1, 2],
    [3, 2, 0, 1, 1, 2, 0, 3],
    [1, 0, 2, 2, 0, 1, 3, 1],
    [2, 1, 3, 0, 1, 0, 2, 1],
  ];
}

// ─── Step model ──────────────────────────────────────────────────────────────
type Phase =
  | "intro"           // 1. What are we calculating
  | "bigpicture"      // 2. Matrix layout, tiles concept
  | "threadmap"       // 3. Thread → C cell mapping
  | "indexing"        // 4. blockIdx/threadIdx → row/col
  | "sharedmem"       // 5. sA / sB declaration
  | "tloop"           // 6. Why the t-loop
  | "loadA"           // 7. Load tile of A
  | "loadB"           // 8. Load tile of B
  | "sync1"           // 9. First __syncthreads
  | "compute"         // 10. Multiply-accumulate per-k
  | "sync2"           // 11. Second __syncthreads
  | "nexttile"        // 12. Move to next tile
  | "write"           // 13. Write C
  | "summary";        // 15. Mental model

interface ExplainerStep {
  id: string;
  phase: Phase;
  label: string;
  desc: string;
  tags: string[];
  // Which C cell we're focusing on (for thread map)
  focusRow?: number;
  focusCol?: number;
  // Which blockIdx for indexing demo
  blockY?: number;
  blockX?: number;
  threadY?: number;
  threadX?: number;
  // Tile iteration
  tileIdx?: number;        // t value
  computeK?: number;       // k within tile
  // Accumulated sum so far (for focus thread)
  partialSum?: number;
  prevTileSum?: number;
  // sA / sB content for current tile
  sA?: number[][];
  sB?: number[][];
  // Highlights
  highlightARow?: number;    // row in A
  highlightBCol?: number;    // col in B
}

function buildSteps(A: number[][], B: number[][]): ExplainerStep[] {
  const steps: ExplainerStep[] = [];

  // ── 1. What are we calculating ────────────────────────────────────────────
  steps.push({
    id: "intro1", phase: "intro", label: "C = A × B",
    desc: "We want to multiply two N×N matrices: C = A × B. Every element of C requires a dot product of a full row of A with a full column of B.",
    tags: ["sig"],
  });

  steps.push({
    id: "intro2", phase: "intro", label: "C[row][col] = Σ A[row][k] × B[k][col]",
    desc: "For example, to get C[2][3]: multiply every element in A's row 2 against every element in B's column 3, and sum the products.",
    tags: ["sig"],
    focusRow: 2, focusCol: 3,
  });

  // ── 2. Big picture — tiles ────────────────────────────────────────────────
  steps.push({
    id: "bigpic1", phase: "bigpicture", label: "#define TILE_SIZE 4",
    desc: "Instead of processing the entire matrices at once, CUDA breaks them into 4×4 tiles. Think of putting a transparent 4×4 grid over each matrix.",
    tags: ["def"],
  });

  steps.push({
    id: "bigpic2", phase: "bigpicture", label: "Each CUDA block handles one 4×4 output tile",
    desc: "A block of 4×4 = 16 threads computes one 4×4 tile of C. For an 8×8 matrix, we launch a 2×2 grid of blocks — 4 blocks total.",
    tags: ["def", "sig"],
    blockY: 0, blockX: 0,
  });

  // ── 3. Thread → C cell mapping ───────────────────────────────────────────
  steps.push({
    id: "thmap1", phase: "threadmap", label: "Each thread computes exactly ONE element of C",
    desc: "Inside the 4×4 block, thread (threadIdx.y, threadIdx.x) is responsible for one cell. Thread (0,0) → C[0][0], thread (1,2) → C[1][2], etc.",
    tags: ["idx"],
  });

  steps.push({
    id: "thmap2", phase: "threadmap", label: "Thread (1,2) → computes C[1][2]",
    desc: "For this block (blockIdx.x=0, blockIdx.y=0): row = 0×4+1 = 1, col = 0×4+2 = 2. This thread owns C[1][2] and will accumulate the full dot product.",
    tags: ["idx"],
    threadY: 1, threadX: 2, blockY: 0, blockX: 0,
    focusRow: 1, focusCol: 2,
  });

  // ── 4. blockIdx/threadIdx indexing ───────────────────────────────────────
  steps.push({
    id: "idx1", phase: "indexing", label: "row = blockIdx.y × TILE_SIZE + threadIdx.y",
    desc: "Each block covers TILE_SIZE rows. blockIdx.y tells which group of rows, threadIdx.y tells which row within the block. Together they give the global row.",
    tags: ["idx"],
    blockY: 1, blockX: 2, threadY: 2, threadX: 3,
  });

  steps.push({
    id: "idx2", phase: "indexing", label: "blockIdx=(2,1): covers C rows 4–7, cols 8–11",
    desc: "row = 1×4 = 4 (block start). col = 2×4 = 8 (block start). Thread (threadIdx.y=2, threadIdx.x=3) inside this block → row=6, col=11 → computes C[6][11].",
    tags: ["idx"],
    blockY: 1, blockX: 2, threadY: 2, threadX: 3,
    focusRow: 6, focusCol: 11,
  });

  // ── 5. Shared memory ─────────────────────────────────────────────────────
  steps.push({
    id: "smem1", phase: "sharedmem", label: "__shared__ float sA[4][4] and sB[4][4]",
    desc: "Each block gets two 4×4 scratch pads in on-chip shared memory (~100× faster than global DRAM). All 16 threads in the block can read from these at nearly zero cost.",
    tags: ["smem"],
  });

  steps.push({
    id: "smem2", phase: "sharedmem", label: "Purpose: load once, reuse many times",
    desc: "Without shared memory, every thread reads the same global memory — 16 threads × N reads = enormous waste. With shared memory, the tile is loaded once cooperatively and every thread reuses it.",
    tags: ["smem"],
  });

  // ── 6. The t-loop ────────────────────────────────────────────────────────
  steps.push({
    id: "tloop1", phase: "tloop", label: "Why the t-loop? Because A and B are 8×8, tiles are 4×4",
    desc: "To compute C[0..3][0..3], we need the full row 0–3 of A (8 columns) and full column 0–3 of B (8 rows). But sA/sB only hold 4×4 at a time. So we loop: first load columns 0–3, then load columns 4–7.",
    tags: ["tloop"],
  });

  steps.push({
    id: "tloop2", phase: "tloop", label: "t=0: pair A00 with B00",
    desc: "C00 (top-left 4×4 of C) = A00 × B00 + A01 × B10. On iteration t=0 we load tile A00 and tile B00 into sA/sB.",
    tags: ["tloop"],
    tileIdx: 0,
  });

  steps.push({
    id: "tloop3", phase: "tloop", label: "t=1: pair A01 with B10",
    desc: "On iteration t=1 we load tile A01 and tile B10, accumulate the second partial product, and finish computing C00.",
    tags: ["tloop"],
    tileIdx: 1,
  });

  // ── 7. Load A ────────────────────────────────────────────────────────────
  const sA0 = A.slice(0, T).map(row => row.slice(0, T));
  const sB0 = B.slice(0, T).map(row => row.slice(0, T));

  steps.push({
    id: "ldA1", phase: "loadA", label: "Load A tile: sA[ty][tx] = A[row][t×4+tx]",
    desc: "Each thread loads ONE element from A into sA. Thread (ty,tx) loads A[row][t×TILE+tx]. This is coalesced: consecutive threads (different tx) access consecutive columns.",
    tags: ["ldA"],
    tileIdx: 0, sA: sA0, sB: sB0,
    highlightARow: 0,
  });

  steps.push({
    id: "ldA2", phase: "loadA", label: "After load: sA holds the 4×4 tile of A",
    desc: "All 16 threads cooperatively loaded 16 values. The entire top-left 4×4 of A is now in fast shared memory. No thread needs to touch global memory again for this tile.",
    tags: ["ldA"],
    tileIdx: 0, sA: sA0, sB: sB0,
  });

  // ── 8. Load B ────────────────────────────────────────────────────────────
  steps.push({
    id: "ldB1", phase: "loadB", label: "Load B tile: sB[ty][tx] = B[t×4+ty][col]",
    desc: "Each thread loads ONE element from B into sB. Thread (ty,tx) loads B[t×TILE+ty][col]. Consecutive threads (different tx) write to consecutive sB columns.",
    tags: ["ldB"],
    tileIdx: 0, sA: sA0, sB: sB0,
    highlightBCol: 0,
  });

  steps.push({
    id: "ldB2", phase: "loadB", label: "sA and sB are now both loaded",
    desc: "The two 4×4 tiles are sitting in shared memory. Together they hold all the data needed for this iteration of the t-loop.",
    tags: ["ldB"],
    tileIdx: 0, sA: sA0, sB: sB0,
  });

  // ── 9. First __syncthreads ────────────────────────────────────────────────
  steps.push({
    id: "sync1a", phase: "sync1", label: "__syncthreads() — Barrier 1",
    desc: "CRITICAL: we cannot start computing until ALL 16 threads have finished loading. __syncthreads() is a block-wide barrier — every thread must reach this line before any thread can continue.",
    tags: ["sync1"],
    tileIdx: 0, sA: sA0, sB: sB0,
  });

  steps.push({
    id: "sync1b", phase: "sync1", label: "Without this barrier: data race!",
    desc: "Thread (0,0) might finish loading its A element instantly and start computing — but sA[3][3] hasn't been loaded yet by thread (3,3). The barrier prevents this race condition.",
    tags: ["sync1"],
    tileIdx: 0, sA: sA0, sB: sB0,
  });

  // ── 10. Per-k compute ─────────────────────────────────────────────────────
  let partialSum = 0;
  for (let k = 0; k < T; k++) {
    const aVal = sA0[1][k]; // thread (1,2) → row=1
    const bVal = sB0[k][2]; // thread (1,2) → col=2
    partialSum += aVal * bVal;
    steps.push({
      id: `mac_k${k}`, phase: "compute",
      label: `k=${k}: sA[ty][${k}] × sB[${k}][tx] — thread (1,2) → C[1][2]`,
      desc: `Thread (ty=1, tx=2) reads sA[1][${k}]=${aVal} (row 1 of A tile) and sB[${k}][2]=${bVal} (col 2 of B tile). Product = ${aVal}×${bVal}=${aVal * bVal}. Running sum = ${partialSum}.`,
      tags: ["mac"],
      tileIdx: 0, sA: sA0, sB: sB0,
      computeK: k, partialSum,
      focusRow: 1, focusCol: 2,
      threadY: 1, threadX: 2,
    });
  }

  // ── 11. Second __syncthreads ──────────────────────────────────────────────
  steps.push({
    id: "sync2a", phase: "sync2", label: "__syncthreads() — Barrier 2",
    desc: "Before the next tile iteration overwrites sA/sB, all threads must finish using the current tile's values. This second barrier prevents thread A from loading new data while thread B is still reading old data.",
    tags: ["sync2"],
    tileIdx: 0, sA: sA0, sB: sB0, partialSum,
  });

  steps.push({
    id: "sync2b", phase: "sync2", label: "Two barriers, two different jobs",
    desc: "Barrier 1 (after load): ensures data is ready to use. Barrier 2 (after compute): ensures data is done being used before it gets overwritten. Both are required.",
    tags: ["sync2", "sync1"],
    tileIdx: 0, sA: sA0, sB: sB0, partialSum,
  });

  // ── 12. Next tile ─────────────────────────────────────────────────────────
  const sA1 = A.slice(0, T).map(row => row.slice(T, T + T));
  const sB1 = B.slice(T, T + T).map(row => row.slice(0, T));
  const prevSum = partialSum;
  for (let k = 0; k < T; k++) {
    const aVal = sA1[1][k];
    const bVal = sB1[k][2];
    partialSum += aVal * bVal;
  }

  steps.push({
    id: "next1", phase: "nexttile", label: "t=1: Load next pair of tiles",
    desc: "Now sA gets the SECOND 4×4 block of A's row (columns 4–7), and sB gets the SECOND 4×4 block of B's column (rows 4–7). The accumulated sum grows.",
    tags: ["tloop", "ldA", "ldB"],
    tileIdx: 1, sA: sA1, sB: sB1,
    prevTileSum: prevSum, partialSum,
    focusRow: 1, focusCol: 2,
  });

  steps.push({
    id: "next2", phase: "nexttile", label: "After both tiles: C[1][2] = sum of ALL k products",
    desc: `Thread (1,2) has now processed all 8 multiply-adds (4 from tile t=0, 4 from tile t=1). The final sum is ${partialSum}.`,
    tags: ["tloop", "init"],
    tileIdx: 1, sA: sA1, sB: sB1,
    partialSum,
    focusRow: 1, focusCol: 2,
  });

  // ── 13. Write ─────────────────────────────────────────────────────────────
  steps.push({
    id: "write1", phase: "write", label: "if (row < N && col < N) C[row×N+col] = sum",
    desc: `Each thread writes its accumulated sum to global memory. The bounds check handles matrices where N is not divisible by TILE_SIZE — out-of-bounds threads write nothing.`,
    tags: ["wr"],
    partialSum,
    focusRow: 1, focusCol: 2,
  });

  // ── 14. Summary ───────────────────────────────────────────────────────────
  steps.push({
    id: "summary", phase: "summary", label: "Mental model — the complete picture",
    desc: "Each CUDA block computes a 4×4 chunk of C by repeatedly loading 4×4 chunks of A and B into shared memory, multiplying them element-wise, accumulating, then writing 16 answers back.",
    tags: ["sig"],
  });

  return steps;
}

// ─── Sub-component: 8×8 Matrix Grid ──────────────────────────────────────────
function BigMatrixGrid({
  label,
  data,
  size = 8,
  tileSize = 4,
  highlightTile,
  highlightCell,
  highlightRow,
  highlightCol,
  dimOutsideTile,
}: {
  label: string;
  data: number[][];
  size?: number;
  tileSize?: number;
  highlightTile?: { row: number; col: number }; // tile indices
  highlightCell?: { row: number; col: number }; // absolute cell
  highlightRow?: number;
  highlightCol?: number;
  dimOutsideTile?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">{label}</div>
      <div className="relative">
        {Array.from({ length: size }, (_, r) => (
          <div key={r} className="flex gap-0">
            {Array.from({ length: size }, (_, c) => {
              const inHighlightTile = highlightTile
                ? Math.floor(r / tileSize) === highlightTile.row && Math.floor(c / tileSize) === highlightTile.col
                : false;
              const isHighlightCell = highlightCell?.row === r && highlightCell?.col === c;
              const isHighlightRow = highlightRow === r;
              const isHighlightCol = highlightCol === c;

              const dimmed = dimOutsideTile && highlightTile && !inHighlightTile;

              let bg = "bg-[#f3eadb] text-[#85704f] border-[#e5d9c0]";
              if (isHighlightCell) bg = "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold";
              else if (inHighlightTile) bg = "bg-[#e5d9c0] text-[#2a1c0d] border-[#85704f] font-semibold";
              else if (isHighlightRow || isHighlightCol) bg = "bg-[#ebe0ca] text-[#5e4a30] border-[#bfad88]";
              else if (dimmed) bg = "bg-[#f3eadb] text-[#cbbb98] border-[#ebe0ca]";

              // Tile boundary lines
              const borderL = c % tileSize === 0 ? "border-l-2 border-l-[#a69272]" : "";
              const borderT = r % tileSize === 0 ? "border-t-2 border-t-[#a69272]" : "";

              return (
                <div
                  key={c}
                  className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border-b border-r transition-all duration-150 ${bg} ${borderL} ${borderT}`}
                >
                  {dimmed ? "" : (data[r]?.[c] ?? "·")}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-component: 4×4 Thread Grid ──────────────────────────────────────────
function ThreadGrid({
  focusThread,
  showLabels = true,
}: {
  focusThread?: { y: number; x: number };
  showLabels?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">4×4 Thread Block</div>
      {showLabels && (
        <div className="flex gap-0 mb-0.5 ml-8">
          {Array.from({ length: T }, (_, x) => (
            <div key={x} className="w-10 text-center text-[8px] font-mono text-[#bfad88]">tx={x}</div>
          ))}
        </div>
      )}
      {Array.from({ length: T }, (_, y) => (
        <div key={y} className="flex items-center gap-0">
          {showLabels && (
            <div className="w-8 text-right text-[8px] font-mono text-[#bfad88] pr-1">ty={y}</div>
          )}
          {Array.from({ length: T }, (_, x) => {
            const isFocus = focusThread?.y === y && focusThread?.x === x;
            return (
              <div
                key={x}
                className={`w-10 h-10 flex flex-col items-center justify-center text-[9px] font-mono border transition-all duration-150 ${
                  isFocus
                    ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold"
                    : "bg-[#f1e7d5] text-[#85704f] border-[#dccfb2]"
                }`}
              >
                <span>{isFocus ? "★" : `T${y}${x}`}</span>
                {isFocus && <span className="text-[7px]">you</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-component: sA / sB with highlights ───────────────────────────────────
function SharedMemGrid({
  label,
  data,
  highlightRow,
  highlightCol,
  activeK,
}: {
  label: string;
  data: number[][];
  highlightRow?: number;
  highlightCol?: number;
  activeK?: number; // for A: highlight col=k, for B: highlight row=k
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-[#bfad88] mb-1">{label}</div>
      <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${T}, 28px)` }}>
        {data.flatMap((row, r) =>
          row.map((val, c) => {
            const isRow = highlightRow === r;
            const isCol = highlightCol === c;
            const isActiveK = activeK != null &&
              ((label.includes("sA") && c === activeK && r === (highlightRow ?? 1)) ||
               (label.includes("sB") && r === activeK && c === (highlightCol ?? 2)));

            let cls = "bg-[#ebe0ca] text-[#5e4a30] border-[#cfc09e]";
            if (isActiveK) cls = "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold";
            else if (isRow || isCol) cls = "bg-[#cfc09e] text-[#2a1c0d] border-[#85704f] font-semibold";

            return (
              <div key={`${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border transition-all duration-150 ${cls}`}>
                {val}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Sub-component: Dot product accumulation trace ────────────────────────────
function DotProductTrace({
  sA,
  sB,
  curK,
  threadY,
  threadX,
  prevSum = 0,
}: {
  sA: number[][];
  sB: number[][];
  curK: number;
  threadY: number;
  threadX: number;
  prevSum?: number;
}) {
  let runSum = prevSum;
  return (
    <div className="border border-[#dccfb2] p-3 space-y-0.5">
      <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
        Dot Product · Thread ({threadY},{threadX}) · sA row {threadY} × sB col {threadX}
      </div>
      {Array.from({ length: curK + 1 }, (_, k) => {
        const a = sA[threadY][k];
        const b = sB[k][threadX];
        const p = a * b;
        runSum += p;
        const isCur = k === curK;
        return (
          <div key={k} className={`font-mono text-[11px] ${isCur ? "text-[#2a1c0d] font-bold" : "text-[#967f5e]"}`}>
            k={k}:  sA[{threadY}][{k}] × sB[{k}][{threadX}] = {a} × {b} = {p}
            <span className={isCur ? " font-black" : ""}> → sum = {runSum - (isCur ? 0 : 0)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TiledExplainerSimulation() {
  const A = useMemo(() => makeA(), []);
  const B = useMemo(() => makeB(), []);
  const allSteps = useMemo(() => buildSteps(A, B), [A, B]);

  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [showCode, setShowCode] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    const tick = () => {
      setIdx(prev => {
        const next = prev + 1;
        if (next >= allSteps.length) { setPlaying(false); return prev; }
        return next;
      });
    };
    if (idx < 0) setIdx(0);
    timerRef.current = setInterval(tick, 2400 - speed * 180);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, allSteps.length, idx]);

  const cur = idx >= 0 ? allSteps[idx] : null;

  // ── Phase-specific visualization ──────────────────────────────────────────
  const renderViz = () => {
    if (!cur) {
      // idle: show both matrices side-by-side
      return (
        <div className="flex gap-6 flex-wrap">
          <BigMatrixGrid label="Matrix A (8×8)" data={A} />
          <BigMatrixGrid label="Matrix B (8×8)" data={B} />
        </div>
      );
    }

    switch (cur.phase) {
      case "intro":
        return (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap items-end">
              <BigMatrixGrid
                label="Matrix A"
                data={A}
                size={8}
                highlightRow={cur.focusRow}
              />
              <div className="text-[#bfad88] text-2xl font-light self-center pb-6">×</div>
              <BigMatrixGrid
                label="Matrix B"
                data={B}
                size={8}
                highlightCol={cur.focusCol}
              />
              <div className="text-[#bfad88] text-2xl font-light self-center pb-6">=</div>
              <div>
                <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">Matrix C</div>
                <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(8, 28px)` }}>
                  {Array.from({ length: 8 }, (_, r) =>
                    Array.from({ length: 8 }, (_, c) => {
                      const val = Array.from({ length: 8 }, (_, k) => A[r][k] * B[k][c]).reduce((a, b) => a + b, 0);
                      const isFocus = cur.focusRow === r && cur.focusCol === c;
                      return (
                        <div key={`${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[9px] font-mono border ${
                          isFocus ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold" : "bg-[#f3eadb] text-[#a69272] border-[#e5d9c0]"
                        }`}>
                          {isFocus ? val : "·"}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            {cur.focusRow != null && cur.focusCol != null && (
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] text-[#5e4a30] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">
                  C[{cur.focusRow}][{cur.focusCol}] = Σ A[{cur.focusRow}][k] × B[k][{cur.focusCol}]
                </div>
                {Array.from({ length: 8 }, (_, k) => (
                  <div key={k} className="text-[11px]">
                    <span className="text-[#bfad88]">k={k}: </span>
                    A[{cur.focusRow}][{k}]×B[{k}][{cur.focusCol}] = {A[cur.focusRow!][k]}×{B[k][cur.focusCol!]} = {A[cur.focusRow!][k] * B[k][cur.focusCol!]}
                  </div>
                ))}
                <div className="text-[#2a1c0d] font-bold mt-1">
                  = {Array.from({ length: 8 }, (_, k) => A[cur.focusRow!][k] * B[k][cur.focusCol!]).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            )}
          </div>
        );

      case "bigpicture":
        return (
          <div className="flex gap-6 flex-wrap">
            <BigMatrixGrid
              label="Matrix A — with 4×4 tile grid"
              data={A}
              size={8}
              tileSize={4}
              highlightTile={cur.blockY != null ? { row: 0, col: 0 } : undefined}
              dimOutsideTile={cur.blockY != null}
            />
            <BigMatrixGrid
              label="Matrix B — with 4×4 tile grid"
              data={B}
              size={8}
              tileSize={4}
            />
            {cur.blockY != null && (
              <div className="border border-[#dccfb2] p-3 text-[11px] font-mono text-[#5e4a30] self-start">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Grid Launch</div>
                <div>dim3 threads(<span className="text-[#2a1c0d] font-bold">4, 4</span>);</div>
                <div>dim3 blocks(<span className="text-[#2a1c0d] font-bold">2, 2</span>);  <span className="text-[#bfad88]">// for N=8</span></div>
                <div className="mt-2 text-[#967f5e]">= 4 blocks × 16 threads = 64 threads</div>
                <div className="text-[#967f5e]">= one thread per C element</div>
              </div>
            )}
          </div>
        );

      case "threadmap":
        return (
          <div className="space-y-4">
            <div className="flex gap-6 flex-wrap">
              <ThreadGrid
                focusThread={cur.threadY != null ? { y: cur.threadY!, x: cur.threadX! } : undefined}
              />
              {cur.focusRow != null && (
                <div className="border border-[#dccfb2] p-3 self-start">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                    Thread → C element
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {Array.from({ length: T }, (_, y) =>
                      Array.from({ length: T }, (_, x) => {
                        const isFocus = y === cur.threadY && x === cur.threadX;
                        return (
                          <div key={`${y}${x}`} className={isFocus ? "text-[#2a1c0d] font-bold" : "text-[#bfad88]"}>
                            thread ({y},{x}) → C[{y}][{x}]{isFocus ? " ← focus" : ""}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {cur.focusRow == null && (
                <div className="border border-[#dccfb2] p-3 self-start">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                    Thread → C element (block 0,0)
                  </div>
                  <div className="space-y-0.5 font-mono text-[11px]">
                    {Array.from({ length: T }, (_, y) =>
                      Array.from({ length: T }, (_, x) => (
                        <div key={`${y}${x}`} className="text-[#765f41]">
                          thread ({y},{x}) → C[{y}][{x}]
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "indexing":
        return (
          <div className="space-y-4">
            <div className="border border-[#dccfb2] p-4 font-mono text-[12px] space-y-2">
              <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-3">Index Calculation</div>
              <div className="text-[#5e4a30]">TILE_SIZE = <span className="text-[#2a1c0d] font-bold">4</span></div>
              <div className="text-[#5e4a30]">blockIdx.x = <span className="text-[#2a1c0d] font-bold">{cur.blockX}</span>,  blockIdx.y = <span className="text-[#2a1c0d] font-bold">{cur.blockY}</span></div>
              <div className="text-[#5e4a30]">threadIdx.x = <span className="text-[#2a1c0d] font-bold">{cur.threadX}</span>,  threadIdx.y = <span className="text-[#2a1c0d] font-bold">{cur.threadY}</span></div>
              <div className="border-t border-[#dccfb2] mt-2 pt-2">
                <div className="text-[#5e4a30]">
                  row = blockIdx.y × 4 + threadIdx.y = {cur.blockY} × 4 + {cur.threadY} = <span className="text-[#2a1c0d] font-bold">{cur.blockY! * 4 + cur.threadY!}</span>
                </div>
                <div className="text-[#5e4a30]">
                  col = blockIdx.x × 4 + threadIdx.x = {cur.blockX} × 4 + {cur.threadX} = <span className="text-[#2a1c0d] font-bold">{cur.blockX! * 4 + cur.threadX!}</span>
                </div>
              </div>
              {cur.focusRow != null && (
                <div className="border border-[#2a1c0d] p-2 mt-2 text-[#2a1c0d] font-bold">
                  → This thread computes C[{cur.blockY! * 4 + cur.threadY!}][{cur.blockX! * 4 + cur.threadX!}]
                </div>
              )}
            </div>
          </div>
        );

      case "sharedmem":
        return (
          <div className="space-y-4">
            <div className="flex gap-8 flex-wrap">
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">sA[4][4] — shared memory</div>
                <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${T}, 36px)` }}>
                  {Array.from({ length: T * T }, (_, i) => (
                    <div key={i} className="w-9 h-9 flex items-center justify-center text-[10px] font-mono border border-dashed border-[#bfad88] text-[#bfad88]">
                      ?
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-[#bfad88]">4×4 = 16 floats = 64 bytes</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">sB[4][4] — shared memory</div>
                <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${T}, 36px)` }}>
                  {Array.from({ length: T * T }, (_, i) => (
                    <div key={i} className="w-9 h-9 flex items-center justify-center text-[10px] font-mono border border-dashed border-[#bfad88] text-[#bfad88]">
                      ?
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-[#bfad88]">4×4 = 16 floats = 64 bytes</div>
              </div>
              <div className="border border-[#dccfb2] p-3 self-start text-[11px] font-mono space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Memory Comparison</div>
                <div className="text-[#5e4a30]">Global DRAM: <span className="text-[#d44]">~400ns latency</span></div>
                <div className="text-[#5e4a30]">L2 cache:    <span className="text-[#967f5e]">~200ns</span></div>
                <div className="text-[#5e4a30]">Shared mem:  <span className="text-[#2a1c0d] font-bold">~5ns (80×)</span></div>
                <div className="mt-2 text-[#5e4a30]">Each float read from sA/sB</div>
                <div className="text-[#5e4a30]">costs ~5ns instead of ~400ns.</div>
              </div>
            </div>
            {cur.id === "smem2" && (
              <div className="border border-[#2a1c0d] p-3 text-[11px] font-mono">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Without shared memory</div>
                <div className="text-[#5e4a30]">16 threads × 4 reads from A = <span className="text-[#d44]">64 global reads per tile</span></div>
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mt-2 mb-1">With shared memory</div>
                <div className="text-[#5e4a30]">16 threads load tile once = <span className="text-[#2a1c0d] font-bold">16 global reads per tile</span></div>
                <div className="text-[#5e4a30]">Then 64 reads from fast shared memory</div>
              </div>
            )}
          </div>
        );

      case "tloop":
        return (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div>
                <BigMatrixGrid
                  label="Matrix A"
                  data={A}
                  size={8}
                  highlightTile={cur.tileIdx != null ? { row: 0, col: cur.tileIdx } : undefined}
                  dimOutsideTile={cur.tileIdx != null}
                />
              </div>
              <div className="self-center text-[#bfad88] text-xl font-light">×</div>
              <div>
                <BigMatrixGrid
                  label="Matrix B"
                  data={B}
                  size={8}
                  highlightTile={cur.tileIdx != null ? { row: cur.tileIdx, col: 0 } : undefined}
                  dimOutsideTile={cur.tileIdx != null}
                />
              </div>
            </div>
            {cur.tileIdx != null && (
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px]">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Tile Loop Progress</div>
                {Array.from({ length: Math.ceil(N / T) }, (_, t) => (
                  <div key={t} className={`${cur.tileIdx! >= t ? "text-[#2a1c0d] font-semibold" : "text-[#bfad88]"}`}>
                    t={t}: A tile [{0}][{t}] × B tile [{t}][{0}]{cur.tileIdx === t ? " ← current" : cur.tileIdx! > t ? " ✓ done" : ""}
                  </div>
                ))}
                <div className="text-[#5e4a30] mt-2">
                  C[0..3][0..3] = Σ A[0..3][t×4..(t+1)×4-1] × B[t×4..(t+1)×4-1][0..3]
                </div>
              </div>
            )}
          </div>
        );

      case "loadA":
      case "loadB":
        return (
          <div className="space-y-4">
            <div className="flex gap-6 flex-wrap">
              <BigMatrixGrid
                label="Matrix A (global memory)"
                data={A}
                size={8}
                highlightTile={{ row: 0, col: cur.tileIdx ?? 0 }}
                dimOutsideTile
              />
              <div className="flex gap-4 items-end">
                {cur.sA && (
                  <SharedMemGrid
                    label={`sA[4][4] ${cur.phase === "loadA" && cur.id.endsWith("2") ? "— fully loaded ✓" : ""}`}
                    data={cur.sA}
                    highlightRow={cur.phase === "loadA" ? cur.highlightARow : undefined}
                  />
                )}
                {cur.sB && (
                  <SharedMemGrid
                    label={`sB[4][4] ${cur.phase === "loadB" && cur.id.endsWith("2") ? "— fully loaded ✓" : ""}`}
                    data={cur.sB}
                    highlightCol={cur.phase === "loadB" ? cur.highlightBCol : undefined}
                  />
                )}
              </div>
            </div>
            {cur.phase === "loadA" && (
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] text-[#5e4a30]">
                <span className="text-[#967f5e]">thread (ty,tx): </span>
                sA[ty][tx] = A[row × N + t×4 + <span className="text-[#2a1c0d] font-bold">tx</span>]
                <div className="text-[#967f5e] text-[10px] mt-1">← tx is the fast index → consecutive threads → consecutive addresses → coalesced ✓</div>
              </div>
            )}
            {cur.phase === "loadB" && (
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] text-[#5e4a30]">
                <span className="text-[#967f5e]">thread (ty,tx): </span>
                sB[ty][tx] = B[(t×4 + ty) × N + <span className="text-[#2a1c0d] font-bold">col</span>]
              </div>
            )}
          </div>
        );

      case "sync1":
      case "sync2": {
        const isSync1 = cur.phase === "sync1";
        return (
          <div className="space-y-4">
            <div className="flex gap-6 flex-wrap">
              <ThreadGrid />
              <div className="self-center space-y-3">
                <div className="border border-[#2a1c0d] p-3 text-[11px] font-mono text-center">
                  <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">
                    {isSync1 ? "Barrier 1" : "Barrier 2"}
                  </div>
                  <div className="text-[#2a1c0d] font-bold">__syncthreads()</div>
                  <div className="text-[#5e4a30] text-[10px] mt-1">
                    {isSync1
                      ? "Wait: sA/sB must be fully loaded"
                      : "Wait: sA/sB must be fully consumed"}
                  </div>
                </div>
                {cur.id.endsWith("b") && (
                  <div className="border border-[#dccfb2] p-3 text-[11px] font-mono space-y-1">
                    <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Two barriers, two purposes</div>
                    <div className="text-[#5e4a30]">Barrier 1: tile fully <span className="text-[#2a1c0d] font-semibold">loaded</span> before use</div>
                    <div className="text-[#5e4a30]">Barrier 2: tile fully <span className="text-[#2a1c0d] font-semibold">used</span> before overwrite</div>
                  </div>
                )}
              </div>
            </div>
            {cur.sA && cur.sB && (
              <div className="flex gap-4">
                <SharedMemGrid label="sA[4][4]" data={cur.sA} />
                <SharedMemGrid label="sB[4][4]" data={cur.sB} />
              </div>
            )}
          </div>
        );
      }

      case "compute":
        return (
          <div className="space-y-4">
            <div className="flex gap-6 flex-wrap">
              <div className="space-y-3">
                <ThreadGrid focusThread={cur.threadY != null ? { y: cur.threadY!, x: cur.threadX! } : undefined} />
                {cur.sA && cur.sB && (
                  <div className="flex gap-4">
                    <SharedMemGrid
                      label="sA[4][4] — row 1 in use"
                      data={cur.sA}
                      highlightRow={cur.threadY}
                      activeK={cur.computeK}
                    />
                    <SharedMemGrid
                      label="sB[4][4] — col 2 in use"
                      data={cur.sB}
                      highlightCol={cur.threadX}
                      activeK={cur.computeK}
                    />
                  </div>
                )}
              </div>
              {cur.sA && cur.sB && cur.computeK != null && (
                <DotProductTrace
                  sA={cur.sA}
                  sB={cur.sB}
                  curK={cur.computeK}
                  threadY={cur.threadY ?? 1}
                  threadX={cur.threadX ?? 2}
                  prevSum={0}
                />
              )}
            </div>
          </div>
        );

      case "nexttile":
        return (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <BigMatrixGrid
                label="Matrix A — tile t=1"
                data={A}
                size={8}
                highlightTile={{ row: 0, col: 1 }}
                dimOutsideTile
              />
              <div className="self-center text-[#bfad88] text-xl">×</div>
              <BigMatrixGrid
                label="Matrix B — tile t=1"
                data={B}
                size={8}
                highlightTile={{ row: 1, col: 0 }}
                dimOutsideTile
              />
            </div>
            {cur.sA && cur.sB && (
              <div className="flex gap-4">
                <SharedMemGrid label="sA[4][4] — tile t=1 (cols 4-7)" data={cur.sA} />
                <SharedMemGrid label="sB[4][4] — tile t=1 (rows 4-7)" data={cur.sB} />
              </div>
            )}
            {cur.prevTileSum != null && (
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] text-[#5e4a30] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Accumulation across tiles</div>
                <div>After t=0: sum = <span className="text-[#2a1c0d] font-semibold">{cur.prevTileSum}</span></div>
                <div>After t=1: sum = <span className="text-[#2a1c0d] font-bold">{cur.partialSum}</span> ← final</div>
              </div>
            )}
          </div>
        );

      case "write":
        return (
          <div className="space-y-4">
            <div className="border border-[#2a1c0d] p-4 font-mono text-[12px]">
              <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Write to Global Memory</div>
              <div className="text-[#5e4a30]">if (row &lt; N &amp;&amp; col &lt; N)</div>
              <div className="text-[#5e4a30]">    C[row × N + col] = sum;</div>
              <div className="mt-3 text-[#5e4a30]">Thread (ty=1, tx=2) writes:</div>
              <div className="text-[#2a1c0d] font-bold">C[1 × 8 + 2] = C[10] = {cur.partialSum}</div>
            </div>
            <div className="text-[10px] font-mono text-[#967f5e] space-y-1">
              <div>Bounds check: threads whose row≥N or col≥N are silently skipped.</div>
              <div>This handles non-square or non-divisible-by-4 matrices.</div>
            </div>
          </div>
        );

      case "summary":
        return (
          <div className="space-y-3">
            <div className="border border-[#2a1c0d] p-4 font-mono text-[11px] space-y-2">
              <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">One Block, One Tile of C</div>
              {[
                "1. Declare sA[4][4] and sB[4][4] in shared memory",
                "2. Each thread calculates its (row, col) in C",
                "3. Initialize sum = 0",
                "4. Loop over tiles t = 0 .. numTiles-1:",
                "     a. Cooperatively load 4×4 tile of A into sA",
                "     b. Cooperatively load 4×4 tile of B into sB",
                "     c. __syncthreads()  ← barrier 1",
                "     d. sum += sA[ty][k] * sB[k][tx]  for k=0..3",
                "     e. __syncthreads()  ← barrier 2",
                "5. Write sum to C[row][col]",
              ].map((line, i) => (
                <div key={i} className={`text-[#5e4a30] ${line.startsWith("4.") || line.startsWith("5.") ? "font-semibold text-[#2a1c0d]" : ""}`}>
                  {line}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#dccfb2] p-3 text-center">
                <div className="text-[10px] font-mono text-[#967f5e] uppercase">Global reads (naive)</div>
                <div className="text-2xl font-heading font-bold text-[#967f5e] mt-1">2N²</div>
                <div className="text-[9px] font-mono text-[#bfad88]">per output tile</div>
              </div>
              <div className="border border-[#2a1c0d] p-3 text-center bg-[#f3eadb]">
                <div className="text-[10px] font-mono text-[#967f5e] uppercase">Global reads (tiled)</div>
                <div className="text-2xl font-heading font-bold text-[#2a1c0d] mt-1">2N²/T</div>
                <div className="text-[9px] font-mono text-[#bfad88]">T = TILE_SIZE reduction</div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Step info */}
          <div className="border border-[#dccfb2] p-3">
            <div className="text-xs font-mono text-[#967f5e] mb-1">
              {cur ? `step ${idx + 1}/${allSteps.length} · ${cur.phase}` : "ready"}
            </div>
            <div className="text-sm font-semibold text-[#2a1c0d] mb-1">
              {cur?.label || "Press RUN to walk through tiled matrix multiplication — step by step"}
            </div>
            <div className="text-xs text-[#5e4a30] leading-relaxed">
              {cur?.desc || "This walkthrough explains every concept: shared memory, thread mapping, tile loops, barriers, and the dot-product accumulation."}
            </div>
          </div>

          {/* CUDA Context Tags */}
          {showTags && cur && (
            <ThreadInfoPanel
              title="CUDA Thread Context"
              variables={(() => {
                const base = [
                  { name: "TILE_SIZE", value: T },
                  { name: "blockDim", value: `(${T}, ${T})` },
                ];
                if (cur.blockX != null) {
                  return [
                    ...base,
                    { name: "blockIdx", value: `(${cur.blockX}, ${cur.blockY})`, highlight: true },
                    ...(cur.threadX != null ? [{ name: "threadIdx", value: `(${cur.threadX}, ${cur.threadY})`, highlight: true }] : []),
                    ...(cur.focusRow != null ? [{ name: "row", value: (cur.blockY! * T + (cur.threadY ?? 0)), highlight: true }] : []),
                    ...(cur.focusCol != null ? [{ name: "col", value: (cur.blockX! * T + (cur.threadX ?? 0)), highlight: true }] : []),
                  ];
                }
                if (cur.tileIdx != null) {
                  return [...base, { name: "t", value: cur.tileIdx, highlight: true }];
                }
                if (cur.computeK != null) {
                  return [
                    ...base,
                    { name: "t", value: 0 },
                    { name: "k", value: cur.computeK, highlight: true },
                    { name: "sum", value: cur.partialSum ?? 0, highlight: true },
                  ];
                }
                return base;
              })()}
            />
          )}

          {/* Phase visualization */}
          {renderViz()}
        </div>

        {showCode && (
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <SimulationCodePanel
              lines={CODE_LINES}
              highlightTags={cur?.tags || ["sig"]}
              filename="matmul_tiled.cu"
            />
          </div>
        )}
      </div>

      <SimulationControls
        isPlaying={playing}
        onPlay={() => { if (idx >= allSteps.length - 1) setIdx(-1); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onStep={() => { setPlaying(false); setIdx(p => Math.min(p + 1, allSteps.length - 1)); }}
        onBack={() => { setPlaying(false); setIdx(p => Math.max(p - 1, -1)); }}
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
