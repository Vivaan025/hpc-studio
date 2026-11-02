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
  { tag: "sig",  html: `${K("__global__")} ${TY("void")} ${F("matmul_coalesced")}(${TY("float")}* A, ${TY("float")}* B, ${TY("float")}* C, ${TY("int")} N) {` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sA[TILE_SIZE][TILE_SIZE];` },
  { tag: "smem", html: `    ${K("__shared__")} ${TY("float")} sB[TILE_SIZE][TILE_SIZE];` },
  { tag: "idx",  html: `    ${TY("int")} row = blockIdx.y * TILE_SIZE + threadIdx.y;` },
  { tag: "idx",  html: `    ${TY("int")} col = blockIdx.x * TILE_SIZE + threadIdx.x;` },
  { tag: "init", html: `    ${TY("float")} sum = ${NUM("0.0f")};` },
  { tag: "loop", html: `    ${K("for")} (${TY("int")} ph = ${NUM("0")}; ph < (N+TILE_SIZE-1)/TILE_SIZE; ph++) {` },
  { tag: "ldA",  html: `        <span style="color:#2a1c0d;font-weight:700">// Coalesced: consecutive threads load consecutive columns</span>` },
  { tag: "ldA",  html: `        sA[ty][<span style="color:#2a1c0d;font-weight:700">tx</span>] = A[row * N + ph*TILE_SIZE + <span style="color:#2a1c0d;font-weight:700">tx</span>];` },
  { tag: "ldB",  html: `        sB[ty][<span style="color:#2a1c0d;font-weight:700">tx</span>] = B[(ph*TILE_SIZE+ty) * N + <span style="color:#2a1c0d;font-weight:700">col</span>];` },
  { tag: "sync", html: `        ${K("__syncthreads")}();` },
  { tag: "mac",  html: `        ${K("#pragma unroll")}` },
  { tag: "mac",  html: `        ${K("for")} (${TY("int")} k = ${NUM("0")}; k < TILE_SIZE; k++)` },
  { tag: "mac",  html: `            sum += sA[ty][k] * sB[k][tx];` },
  { tag: "sync2",html: `        ${K("__syncthreads")}();` },
  { tag: "loop", html: `    }` },
  { tag: "wr",   html: `    ${K("if")} (row < N && col < N) C[row*N+col] = sum;` },
  { tag: "sig",  html: `}` },
];

// ── Matrix size and memory layout ──
const N = 4;
const WARP_SIZE = 4; // simplified warp for visualization

interface MemAddr {
  row: number;
  col: number;
  linearAddr: number;
}

// A memory transaction groups addresses within the same cache line
interface Transaction {
  cacheLineStart: number;
  addresses: number[];
}

interface CoalescedStep {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  // Which threads are active and what addresses they access
  threadAddrs?: { tid: number; addr: MemAddr; matLabel: string }[];
  // Memory transaction visualization
  transactions?: Transaction[];
  transactionCount?: number;
  isCoalesced?: boolean;
  // Comparison mode
  comparison?: {
    label: string;
    threadAddrs: { tid: number; addr: MemAddr; matLabel: string }[];
    transactions: Transaction[];
    transactionCount: number;
    isCoalesced: boolean;
  };
  // For shared memory display
  sA?: number[][];
  sB?: number[][];
  computeK?: number;
  partialSum?: number;
}

function makeMatrix(): number[][] {
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => ((r * 3 + c * 7 + 2) % 5))
  );
}

function buildSteps(A: number[][], B: number[][]): CoalescedStep[] {
  const steps: CoalescedStep[] = [];
  const CACHE_LINE = 4; // simplified: 4 floats per cache line

  steps.push({
    id: "intro", label: "Matrix in Global Memory",
    desc: "A 4×4 matrix stored in row-major order occupies 16 consecutive floats in global memory. Address = row × N + col. Understanding this layout is KEY to coalescing.",
    tags: ["sig", "idx"],
  });

  steps.push({
    id: "explain", label: "What is Coalescing?",
    desc: "When threads in a warp access CONSECUTIVE memory addresses, the GPU combines them into a single memory transaction (128 bytes). Non-consecutive access = multiple transactions = wasted bandwidth.",
    tags: ["ldA"],
  });

  // ── Show coalesced load of A (row access) ──
  const coalescedAddrs = Array.from({ length: WARP_SIZE }, (_, tid) => ({
    tid,
    addr: { row: 0, col: tid, linearAddr: 0 * N + tid },
    matLabel: "A",
  }));
  const coalescedTxns: Transaction[] = [{
    cacheLineStart: 0,
    addresses: coalescedAddrs.map(a => a.addr.linearAddr),
  }];

  steps.push({
    id: "coalesced_a", label: "Loading A: Row Access → COALESCED ✓",
    desc: `Thread 0 reads A[0][0] (addr 0), Thread 1 reads A[0][1] (addr 1), Thread 2 reads A[0][2] (addr 2), Thread 3 reads A[0][3] (addr 3). All addresses are CONSECUTIVE → GPU issues 1 memory transaction!`,
    tags: ["ldA"],
    threadAddrs: coalescedAddrs,
    transactions: coalescedTxns,
    transactionCount: 1,
    isCoalesced: true,
  });

  // ── Show uncoalesced load of A (column access — what you'd get without coalescing) ──
  const uncoalescedAddrs = Array.from({ length: WARP_SIZE }, (_, tid) => ({
    tid,
    addr: { row: tid, col: 0, linearAddr: tid * N + 0 },
    matLabel: "A",
  }));
  const uncoalescedTxns: Transaction[] = uncoalescedAddrs.map(a => ({
    cacheLineStart: Math.floor(a.addr.linearAddr / CACHE_LINE) * CACHE_LINE,
    addresses: [a.addr.linearAddr],
  }));

  steps.push({
    id: "uncoalesced_a", label: "Loading A: Column Access → UNCOALESCED ✗",
    desc: `Thread 0 reads A[0][0] (addr 0), Thread 1 reads A[1][0] (addr 4), Thread 2 reads A[2][0] (addr 8), Thread 3 reads A[3][0] (addr 12). Addresses are STRIDED by N=4 → GPU issues 4 separate transactions!`,
    tags: ["ldA"],
    threadAddrs: uncoalescedAddrs,
    transactions: uncoalescedTxns,
    transactionCount: WARP_SIZE,
    isCoalesced: false,
  });

  // ── Side-by-side comparison ──
  steps.push({
    id: "compare", label: "Comparison: 1 transaction vs 4 transactions",
    desc: "Same data, same warp, but the access PATTERN determines if the GPU issues 1 transaction or 4. This is why memory coalescing can give a 4-10× speedup. The coalesced kernel arranges loads so threadIdx.x varies fastest along the contiguous dimension.",
    tags: ["ldA"],
    threadAddrs: coalescedAddrs,
    transactions: coalescedTxns,
    transactionCount: 1,
    isCoalesced: true,
    comparison: {
      label: "Column Access (Uncoalesced)",
      threadAddrs: uncoalescedAddrs,
      transactions: uncoalescedTxns,
      transactionCount: WARP_SIZE,
      isCoalesced: false,
    },
  });

  // ── Now show the actual coalesced matmul loading tiles ──
  const sA = A.map(row => [...row]);
  const sB = B.map(row => [...row]);

  // Loading B coalesced
  const coalescedB = Array.from({ length: WARP_SIZE }, (_, tid) => ({
    tid,
    addr: { row: 0, col: tid, linearAddr: 0 * N + tid },
    matLabel: "B",
  }));

  steps.push({
    id: "load_b", label: "Loading B: Also Coalesced ✓",
    desc: `sB[ty][tx] = B[(ph*TILE+ty)*N + col]. For row ty=0: Thread 0 reads B[0][0], Thread 1 reads B[0][1], etc. Consecutive threads read consecutive columns → coalesced! Both A and B loads are optimized.`,
    tags: ["ldB"],
    threadAddrs: coalescedB,
    transactions: [{ cacheLineStart: 0, addresses: coalescedB.map(a => a.addr.linearAddr) }],
    transactionCount: 1,
    isCoalesced: true,
    sA, sB,
  });

  steps.push({
    id: "sync", label: "__syncthreads()",
    desc: "Barrier: all threads finish loading before any thread starts computing.",
    tags: ["sync"],
    sA, sB,
  });

  // ── Per-k compute steps ──
  let sum = 0;
  for (let k = 0; k < N; k++) {
    const aVal = sA[0][k];
    const bVal = sB[k][0];
    const prod = aVal * bVal;
    sum += prod;
    steps.push({
      id: `comp_k${k}`, label: `k=${k}: sA[0][${k}] × sB[${k}][0] = ${aVal}×${bVal} = ${prod}`,
      desc: `Read sA[0][${k}]=${aVal} and sB[${k}][0]=${bVal} from shared memory (no global memory access!). Product = ${prod}. Running sum = ${sum}.`,
      tags: ["mac"],
      sA, sB, computeK: k, partialSum: sum,
    });
  }

  steps.push({
    id: "write", label: `Write C[0][0] = ${sum}`,
    desc: `Writing result to global memory. The write C[row*N+col] is also coalesced because consecutive threads write to consecutive addresses.`,
    tags: ["wr"],
    partialSum: sum,
  });

  steps.push({
    id: "summary", label: "Summary: Why Coalescing Matters",
    desc: `Without coalescing: each tile load costs ${WARP_SIZE} transactions. With coalescing: 1 transaction. For large matrices, this means 4-10× better bandwidth utilization. The trick: threadIdx.x should index the fastest-varying (column) dimension.`,
    tags: ["sig"],
  });

  return steps;
}

// ── Component ──
export default function CoalescedSimulation() {
  const A = useMemo(() => makeMatrix(), []);
  const B = useMemo(() => makeMatrix(), []);
  const allSteps = useMemo(() => buildSteps(A, B), [A, B]);

  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [showCode, setShowCode] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    timerRef.current = setInterval(tick, 2200 - speed * 180);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, allSteps.length, idx]);

  const cur = idx >= 0 ? allSteps[idx] : null;

  // Render a memory block showing linear addresses
  const renderMemoryBlock = (
    threadAddrs: CoalescedStep["threadAddrs"],
    transactions: CoalescedStep["transactions"],
    isCoalesced: boolean,
    label: string,
  ) => {
    if (!threadAddrs) return null;
    const maxAddr = N * N;
    const addrSet = new Set(threadAddrs.map(t => t.addr.linearAddr));
    // Which cache lines are active
    const activeCacheLines = new Set(transactions?.map(t => t.cacheLineStart) || []);

    return (
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">
          {label}
        </div>

        {/* Thread → Address mapping */}
        <div className="flex gap-3 flex-wrap">
          {threadAddrs.map((t) => (
            <div key={t.tid} className="text-center">
              <div className="text-[9px] font-mono text-[#bfad88] mb-0.5">T{t.tid}</div>
              <div className={`w-8 h-8 flex items-center justify-center text-[11px] font-mono border font-semibold ${
                isCoalesced
                  ? "bg-[#2a1c0d] text-white border-[#2a1c0d]"
                  : "bg-[#d44] text-white border-[#d44]"
              }`}>
                {t.addr.linearAddr}
              </div>
              <div className="text-[8px] font-mono text-[#a69272] mt-0.5">
                [{t.addr.row}][{t.addr.col}]
              </div>
            </div>
          ))}
        </div>

        {/* Linear memory view */}
        <div>
          <div className="text-[9px] font-mono text-[#bfad88] mb-1">
            Global Memory (row-major, {N}×{N} = {maxAddr} floats)
          </div>
          <div className="flex gap-0 flex-wrap">
            {Array.from({ length: maxAddr }, (_, addr) => {
              const cacheLineStart = Math.floor(addr / WARP_SIZE) * WARP_SIZE;
              const isInActiveCacheLine = activeCacheLines.has(cacheLineStart);
              const isAccessed = addrSet.has(addr);
              const row = Math.floor(addr / N);
              const col = addr % N;

              return (
                <div key={addr} className="relative">
                  {/* Cache line boundary */}
                  {addr % WARP_SIZE === 0 && addr > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#cbbb98]" />
                  )}
                  <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-mono border-y border-r transition-all duration-200 ${
                    addr % WARP_SIZE === 0 ? "border-l" : ""
                  } ${
                    isAccessed
                      ? isCoalesced
                        ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold"
                        : "bg-[#d44] text-white border-[#d44] font-bold"
                      : isInActiveCacheLine
                        ? "bg-[#ebe0ca] text-[#967f5e] border-[#bfad88]"
                        : "bg-white text-[#bfad88] border-[#e5d9c0]"
                  }`}>
                    {A[row]?.[col] ?? "·"}
                  </div>
                  {/* Address label */}
                  <div className={`text-center text-[7px] font-mono mt-0.5 ${
                    isAccessed ? "text-[#2a1c0d] font-semibold" : "text-[#cbbb98]"
                  }`}>
                    {addr}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Row labels */}
          <div className="flex gap-0 mt-1">
            {Array.from({ length: N }, (_, r) => (
              <div key={r} className="text-[8px] font-mono text-[#b3a07a]" style={{ width: `${N * 32}px` }}>
                row {r}
              </div>
            ))}
          </div>
        </div>

        {/* Transaction count */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono font-semibold ${
          isCoalesced
            ? "bg-[#ebe0ca] text-[#2a1c0d] border border-[#2a1c0d]"
            : "bg-[#fef0f0] text-[#d44] border border-[#d44]"
        }`}>
          <span>{transactions?.length ?? 0} memory transaction{(transactions?.length ?? 0) !== 1 ? "s" : ""}</span>
          <span className="text-[9px] font-normal">
            {isCoalesced ? "— addresses consecutive ✓" : "— addresses strided by N ✗"}
          </span>
        </div>
      </div>
    );
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
              {cur?.desc || "Understand how memory access patterns dramatically affect GPU bandwidth."}
            </div>
          </div>

          {/* CUDA Context Tags */}
          {showTags && (
            <ThreadInfoPanel
              title="CUDA Thread Context"
              variables={(() => {
                const base = [
                  { name: "TILE_SIZE", value: N },
                  { name: "blockDim", value: `(${N}, ${N})` },
                  { name: "warpSize", value: WARP_SIZE },
                ];
                if (!cur) return base;
                if (cur.threadAddrs && cur.threadAddrs.length > 0) {
                  const t0 = cur.threadAddrs[0];
                  return [
                    ...base,
                    { name: "threadIdx.x", value: t0.tid, highlight: true },
                    { name: "addr", value: t0.addr.linearAddr, highlight: true },
                    { name: "txns", value: cur.transactionCount ?? "—", highlight: true },
                    { name: "coalesced", value: cur.isCoalesced ? "YES ✓" : "NO ✗", highlight: true },
                  ];
                }
                if (cur.computeK != null) {
                  return [
                    ...base,
                    { name: "k", value: cur.computeK, highlight: true },
                    { name: "sum", value: cur.partialSum ?? 0, highlight: true },
                  ];
                }
                return base;
              })()}
            />
          )}

          {/* Memory layout intro */}
          {cur && !cur.threadAddrs && !cur.sA && !cur.comparison && cur.id !== "summary" && (
            <div className="border border-[#dccfb2] p-4">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                Matrix A in Global Memory (Row-Major)
              </div>
              <div className="flex gap-0 flex-wrap">
                {Array.from({ length: N * N }, (_, addr) => {
                  const row = Math.floor(addr / N);
                  const col = addr % N;
                  return (
                    <div key={addr}>
                      <div className={`w-9 h-9 flex items-center justify-center text-[11px] font-mono border transition-all ${
                        addr % N === 0 ? "border-l-2 border-l-[#967f5e]" : ""
                      } border-[#cfc09e] bg-[#f3eadb] text-[#5e4a30]`}>
                        {A[row][col]}
                      </div>
                      <div className="text-center text-[7px] font-mono text-[#bfad88] mt-0.5">
                        [{row}][{col}]
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-0 mt-2">
                {Array.from({ length: N }, (_, r) => (
                  <div key={r} className="text-[8px] font-mono text-[#b3a07a]" style={{ width: `${N * 36}px` }}>
                    ← row {r} →
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono text-[#967f5e] mt-2">
                addr = row × {N} + col — consecutive columns = consecutive addresses
              </div>
            </div>
          )}

          {/* Primary memory access visualization */}
          {cur?.threadAddrs && !cur.comparison && (
            <div className="border border-[#dccfb2] p-4">
              {renderMemoryBlock(
                cur.threadAddrs,
                cur.transactions,
                cur.isCoalesced ?? true,
                cur.isCoalesced ? "Row Access (Coalesced) ✓" : "Column Access (Uncoalesced) ✗",
              )}
            </div>
          )}

          {/* Comparison view */}
          {cur?.comparison && (
            <div className="space-y-3">
              <div className="border border-[#dccfb2] p-4">
                {renderMemoryBlock(
                  cur.threadAddrs,
                  cur.transactions,
                  cur.isCoalesced ?? true,
                  "Row Access (Coalesced) ✓",
                )}
              </div>
              <div className="text-center text-xs font-mono text-[#967f5e]">vs</div>
              <div className="border border-[#dccfb2] p-4">
                {renderMemoryBlock(
                  cur.comparison.threadAddrs,
                  cur.comparison.transactions,
                  cur.comparison.isCoalesced,
                  cur.comparison.label,
                )}
              </div>
              <div className="border border-[#2a1c0d] bg-[#f3eadb] p-3">
                <div className="text-[11px] font-mono text-[#2a1c0d] font-semibold">
                  Key Insight: Same data, same threads — but {cur.transactionCount} transaction vs {cur.comparison.transactionCount} transactions.
                </div>
                <div className="text-[10px] font-mono text-[#5e4a30] mt-1">
                  The coalesced kernel uses threadIdx.x to index columns (consecutive addresses).
                </div>
              </div>
            </div>
          )}

          {/* Shared memory + compute view */}
          {cur?.sA && cur?.sB && (
            <div className="border border-[#dccfb2] p-3">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-2">
                Shared Memory (on-chip SRAM)
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-[9px] font-mono text-[#bfad88] mb-1">sA[{N}][{N}]</div>
                  <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 28px)` }}>
                    {cur.sA.flatMap((row, r) =>
                      row.map((val, c) => {
                        const isActive = cur.computeK != null && r === 0 && c === cur.computeK;
                        return (
                          <div key={`sa${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border transition-all duration-150 ${
                            isActive ? "border-[#2a1c0d] bg-[#2a1c0d] text-white font-bold" : "border-[#cfc09e] bg-[#ebe0ca] text-[#5e4a30]"
                          }`}>{val}</div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-[#bfad88] mb-1">sB[{N}][{N}]</div>
                  <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 28px)` }}>
                    {cur.sB.flatMap((row, r) =>
                      row.map((val, c) => {
                        const isActive = cur.computeK != null && r === cur.computeK && c === 0;
                        return (
                          <div key={`sb${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border transition-all duration-150 ${
                            isActive ? "border-[#2a1c0d] bg-[#2a1c0d] text-white font-bold" : "border-[#cfc09e] bg-[#ebe0ca] text-[#5e4a30]"
                          }`}>{val}</div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Computation trace */}
          {cur?.computeK != null && cur.sA && cur.sB && (
            <div className="border border-[#dccfb2] p-3 space-y-1">
              <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">
                Dot Product · From Shared Memory (fast!)
              </div>
              {Array.from({ length: cur.computeK + 1 }, (_, k) => {
                const aV = cur.sA![0][k];
                const bV = cur.sB![k][0];
                const p = aV * bV;
                const runSum = Array.from({ length: k + 1 }, (_, kk) => cur.sA![0][kk] * cur.sB![kk][0]).reduce((a, b) => a + b, 0);
                const isCurrent = k === cur.computeK;
                return (
                  <div key={k} className={`font-mono text-[12px] ${isCurrent ? "text-[#2a1c0d] font-semibold" : "text-[#967f5e]"}`}>
                    <span>k={k}: sA[0][{k}]×sB[{k}][0] = {aV}×{bV} = {p}</span>
                    <span className={isCurrent ? "font-bold" : ""}> → sum = {runSum}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {cur?.id === "summary" && (
            <div className="border border-[#2a1c0d] p-4 space-y-3">
              <div className="text-sm font-semibold text-[#2a1c0d]">Performance Impact</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[#dccfb2] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase">Without Coalescing</div>
                  <div className="text-xl font-heading font-bold text-[#d44] mt-1">{N}×</div>
                  <div className="text-[10px] font-mono text-[#967f5e]">more transactions</div>
                </div>
                <div className="border border-[#2a1c0d] p-3 text-center bg-[#f3eadb]">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase">With Coalescing</div>
                  <div className="text-xl font-heading font-bold text-[#2a1c0d] mt-1">1×</div>
                  <div className="text-[10px] font-mono text-[#967f5e]">optimal bandwidth</div>
                </div>
              </div>
              <div className="text-xs text-[#5e4a30] leading-relaxed">
                <strong className="text-[#2a1c0d]">Rule:</strong> Make threadIdx.x correspond to the
                fastest-varying (innermost) dimension of your array. For row-major matrices,
                that means threadIdx.x indexes columns.
              </div>
            </div>
          )}
        </div>

        {showCode && (
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <SimulationCodePanel
              lines={CODE_LINES}
              highlightTags={cur?.tags || ["sig"]}
              filename="matmul_coalesced.cu"
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
