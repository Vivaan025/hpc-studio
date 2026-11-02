"use client";

import { useRef, useEffect, useState } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const T = 4;
const N = 8;

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

const A = makeA();
const B = makeB();

// ─── Shared grid primitives ───────────────────────────────────────────────────
function MatrixGrid({
  label,
  data,
  size = 8,
  tileSize = 4,
  highlightTileRow,
  highlightTileCol,
  highlightRow,
  highlightCol,
  highlightCell,
  dimOutsideTile,
  small = false,
}: {
  label: string;
  data: number[][];
  size?: number;
  tileSize?: number;
  highlightTileRow?: number;
  highlightTileCol?: number;
  highlightRow?: number;
  highlightCol?: number;
  highlightCell?: { r: number; c: number };
  dimOutsideTile?: boolean;
  small?: boolean;
}) {
  const cellW = small ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]";
  return (
    <div>
      {label && <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">{label}</div>}
      <div>
        {Array.from({ length: size }, (_, r) => (
          <div key={r} className="flex gap-0">
            {Array.from({ length: size }, (_, c) => {
              const inTile =
                highlightTileRow != null && highlightTileCol != null
                  ? Math.floor(r / tileSize) === highlightTileRow &&
                    Math.floor(c / tileSize) === highlightTileCol
                  : false;
              const dimmed = dimOutsideTile && !inTile && (highlightTileRow != null);
              const isHlRow = highlightRow === r;
              const isHlCol = highlightCol === c;
              const isHlCell = highlightCell?.r === r && highlightCell?.c === c;

              let cls = "bg-[#f3eadb] text-[#85704f] border-[#e5d9c0]";
              if (isHlCell) cls = "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold";
              else if (inTile) cls = "bg-[#e5d9c0] text-[#2a1c0d] border-[#85704f] font-semibold";
              else if (isHlRow || isHlCol) cls = "bg-[#ebe0ca] text-[#5e4a30] border-[#bfad88]";
              else if (dimmed) cls = "bg-white text-[#e5d9c0] border-[#f1e7d5]";

              const bL = c % tileSize === 0 ? "border-l-2 border-l-[#967f5e]" : "";
              const bT = r % tileSize === 0 ? "border-t-2 border-t-[#967f5e]" : "";
              return (
                <div key={c} className={`${cellW} flex items-center justify-center font-mono border-b border-r transition-all ${cls} ${bL} ${bT}`}>
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

function TileGrid4({
  label,
  data,
  highlightRow,
  highlightCol,
  activeCell,
}: {
  label: string;
  data: number[][];
  highlightRow?: number;
  highlightCol?: number;
  activeCell?: { r: number; c: number };
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-[#bfad88] mb-1">{label}</div>
      <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(4, 32px)` }}>
        {data.slice(0, 4).flatMap((row, r) =>
          row.slice(0, 4).map((val, c) => {
            const isActive = activeCell?.r === r && activeCell?.c === c;
            const isHlR = highlightRow === r;
            const isHlC = highlightCol === c;
            let cls = "bg-[#ebe0ca] text-[#5e4a30] border-[#cfc09e]";
            if (isActive) cls = "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold";
            else if (isHlR || isHlC) cls = "bg-[#cfc09e] text-[#2a1c0d] border-[#85704f] font-semibold";
            return (
              <div key={`${r}${c}`} className={`w-8 h-8 flex items-center justify-center text-[11px] font-mono border transition-all ${cls}`}>
                {val}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ThreadBlock({ focusY, focusX }: { focusY?: number; focusX?: number }) {
  return (
    <div>
      <div className="flex gap-0 mb-0.5 ml-8">
        {[0,1,2,3].map(x => <div key={x} className="w-10 text-center text-[8px] font-mono text-[#b3a07a]">tx={x}</div>)}
      </div>
      {[0,1,2,3].map(y => (
        <div key={y} className="flex items-center gap-0">
          <div className="w-8 text-right text-[8px] font-mono text-[#b3a07a] pr-1">ty={y}</div>
          {[0,1,2,3].map(x => {
            const isFocus = y === focusY && x === focusX;
            return (
              <div key={x} className={`w-10 h-10 flex flex-col items-center justify-center text-[9px] font-mono border ${
                isFocus ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold" : "bg-[#f1e7d5] text-[#967f5e] border-[#dccfb2]"
              }`}>
                {isFocus ? "★" : `T${y}${x}`}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] bg-[#f1e7d5] px-1 py-0.5 border border-[#e5d9c0] text-[#2a1c0d]">{children}</code>;
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[11px] bg-[#f3eadb] border border-[#e5d9c0] p-3 overflow-x-auto text-[#41301c] leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

// ─── Step navigator ───────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "s1",  short: "What we compute" },
  { id: "s2",  short: "Tiles" },
  { id: "s3",  short: "Thread → C cell" },
  { id: "s4",  short: "Indexing" },
  { id: "s5",  short: "Shared memory" },
  { id: "s6",  short: "t-loop" },
  { id: "s7",  short: "Load A" },
  { id: "s8",  short: "Load B" },
  { id: "s9",  short: "Barrier 1" },
  { id: "s10", short: "Dot product" },
  { id: "s11", short: "Barrier 2" },
  { id: "s12", short: "Next tile" },
  { id: "s13", short: "Write C" },
  { id: "s14", short: "Summary" },
];

function SectionNav({ active }: { active: string }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#dccfb2] overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`px-3 py-2 text-[10px] font-mono border-r border-[#dccfb2] whitespace-nowrap transition-colors ${
              active === s.id
                ? "bg-[#2a1c0d] text-white"
                : "text-[#967f5e] hover:text-[#5e4a30] hover:bg-[#f1e7d5]"
            }`}
          >
            <span className="text-[9px] mr-1 opacity-50">{i + 1}.</span>
            {s.short}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id,
  num,
  title,
  visual,
  children,
}: {
  id: string;
  num: number;
  title: string;
  visual: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="border-b border-[#dccfb2] py-10 scroll-mt-10">
      <div className="flex items-baseline gap-3 mb-6">
        <span className="text-[11px] font-mono text-[#bfad88] tracking-widest">{String(num).padStart(2, "0")}</span>
        <h2 className="text-base font-heading font-bold text-[#2a1c0d]">{title}</h2>
      </div>
      <div className="flex gap-8 flex-wrap lg:flex-nowrap items-start">
        {/* Visual — fixed width column */}
        <div className="flex-shrink-0 space-y-4 lg:max-w-[480px]">
          {visual}
        </div>
        {/* Text — prose column */}
        <div className="flex-1 min-w-0 space-y-3 text-[13px] text-[#4d3b25] leading-relaxed font-sans">
          {children}
        </div>
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[#4d3b25] leading-relaxed">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[#2a1c0d] pl-3 text-[12px] text-[#5e4a30] leading-relaxed italic">
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TiledWalkthrough() {
  const [active, setActive] = useState("s1");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // Precompute C for section 1
  const C = A.map(row => A[0].map((_, c) => row.reduce((sum, _, k) => sum + A[row.indexOf(row[0])][k] * B[k][c], 0)));
  // Actually compute correctly
  const Cmat = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) =>
      Array.from({ length: N }, (_, k) => A[r][k] * B[k][c]).reduce((a, b) => a + b, 0)
    )
  );

  const sA0 = A.slice(0, T).map(row => row.slice(0, T));
  const sB0 = B.slice(0, T).map(row => row.slice(0, T));
  const sA1 = A.slice(0, T).map(row => row.slice(T, T + T));
  const sB1 = B.slice(T, T + T).map(row => row.slice(0, T));

  return (
    <div>
      <SectionNav active={active} />

      <div className="space-y-0">

        {/* ── 1. What we compute ─────────────────────────────────────────── */}
        <Section id="s1" num={1} title="What are we computing?"
          visual={
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap items-end">
                <MatrixGrid label="Matrix A" data={A} highlightRow={2} />
                <span className="text-[#bfad88] text-xl font-light self-center pb-6">×</span>
                <MatrixGrid label="Matrix B" data={B} highlightCol={3} />
                <span className="text-[#bfad88] text-xl font-light self-center pb-6">=</span>
                <div>
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest mb-1">C (result)</div>
                  <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(8, 28px)` }}>
                    {Cmat.flatMap((row, r) => row.map((val, c) => (
                      <div key={`${r}${c}`} className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono border ${
                        r === 2 && c === 3
                          ? "bg-[#2a1c0d] text-white border-[#2a1c0d] font-bold"
                          : "bg-[#f3eadb] text-[#bfad88] border-[#ebe0ca]"
                      }`}>
                        {r === 2 && c === 3 ? val : "·"}
                      </div>
                    )))}
                  </div>
                </div>
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">C[2][3] = Σ A[2][k] × B[k][3]</div>
                {Array.from({ length: N }, (_, k) => (
                  <div key={k} className="text-[#765f41]">
                    k={k}: {A[2][k]}×{B[k][3]} = {A[2][k] * B[k][3]}
                  </div>
                ))}
                <div className="text-[#2a1c0d] font-bold border-t border-[#dccfb2] mt-1 pt-1">
                  = {Cmat[2][3]}
                </div>
              </div>
            </div>
          }
        >
          <P>We are computing <strong>C = A × B</strong>, where A and B are N×N matrices. Each output element C[row][col] is the <em>dot product</em> of an entire row of A with an entire column of B:</P>
          <Pre>{`C[row][col] = Σ A[row][k] × B[k][col]
              for k = 0 .. N-1`}</Pre>
          <P>For example, to compute <Code>C[2][3]</Code>, we multiply A's row 2 (highlighted in grey) against B's column 3 (also highlighted), and sum all 8 products.</P>
          <P>The naive CUDA kernel does exactly this, but with one thread per output cell doing all N multiplications against slow global memory. The tiled kernel does the same math — just smarter about where it reads from.</P>
          <Note>The visual shows the 8×8 A and B matrices. The highlighted row (A) and column (B) are the ones involved in computing C[2][3] = {Cmat[2][3]}.</Note>
        </Section>

        {/* ── 2. Tiles concept ──────────────────────────────────────────── */}
        <Section id="s2" num={2} title="Breaking it into 4×4 tiles"
          visual={
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <MatrixGrid label="Matrix A — 4×4 tile grid" data={A}
                  highlightTileRow={0} highlightTileCol={0} dimOutsideTile />
                <MatrixGrid label="Matrix B — 4×4 tile grid" data={B} />
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Grid Launch</div>
                <div>dim3 threads(<span className="font-bold text-[#2a1c0d]">4, 4</span>);</div>
                <div>dim3 blocks(<span className="font-bold text-[#2a1c0d]">N/4, N/4</span>);  <span className="text-[#bfad88]">// for N=8: (2,2)</span></div>
                <div className="mt-2 text-[#967f5e]">= 4 blocks × 16 threads = 64 threads total</div>
                <div className="text-[#967f5e]">= exactly one thread per element of C</div>
              </div>
            </div>
          }
        >
          <P>Instead of processing the full N×N matrices at once, the tiled kernel superimposes a <strong>4×4 grid</strong> over each matrix. Each square of the grid is a <em>tile</em>.</P>
          <Pre>{`#define TILE_SIZE 4

dim3 threads(TILE_SIZE, TILE_SIZE);    // 16 threads per block
dim3 blocks((N+3)/4, (N+3)/4);        // 2×2 blocks for N=8
matmul_tiled<<<blocks, threads>>>(A, B, C, N);`}</Pre>
          <P>Each CUDA block handles <strong>one 4×4 output tile of C</strong>. The highlighted tile in the visual shows the <em>top-left</em> 4×4 of A. The rest is dimmed — this block ignores it for now.</P>
          <P>For an 8×8 matrix there are 2×2 = 4 blocks. For a 4096×4096 matrix there'd be 1024×1024 = 1M blocks — all running in parallel.</P>
          <Note>TILE_SIZE=4 is used here for clarity. Real kernels use 16 or 32. The math is identical.</Note>
        </Section>

        {/* ── 3. Thread → C cell mapping ───────────────────────────────── */}
        <Section id="s3" num={3} title="Each thread computes exactly one element of C"
          visual={
            <div className="space-y-4">
              <ThreadBlock focusY={1} focusX={2} />
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Thread → C element (block 0,0)</div>
                {[0,1,2,3].flatMap(y => [0,1,2,3].map(x => (
                  <div key={`${y}${x}`} className={y === 1 && x === 2 ? "text-[#2a1c0d] font-bold" : "text-[#b3a07a]"}>
                    thread ({y},{x}) → C[{y}][{x}]{y === 1 && x === 2 ? " ← focus" : ""}
                  </div>
                )))}
              </div>
            </div>
          }
        >
          <P>Inside each 4×4 block, <strong>thread (threadIdx.y, threadIdx.x)</strong> is responsible for computing <strong>exactly one element of C</strong>.</P>
          <Pre>{`C tile

        col
        ↓
      0   1   2   3
    ┌───┬───┬───┬───┐
  0 │T00│T01│T02│T03│
    ├───┼───┼───┼───┤
  1 │T10│T11│T12│T13│  ← row
    ├───┼───┼───┼───┤
  2 │T20│T21│T22│T23│
    ├───┼───┼───┼───┤
  3 │T30│T31│T32│T33│
    └───┴───┴───┴───┘`}</Pre>
          <P>Thread <Code>(1, 2)</Code> (marked ★ in the visual) owns <Code>C[1][2]</Code>. It will accumulate the entire dot product for that cell and write the final result.</P>
          <P>All 16 threads run <em>in parallel</em> — they are all computing their own sum simultaneously. This is the core GPU parallelism.</P>
        </Section>

        {/* ── 4. Indexing ──────────────────────────────────────────────── */}
        <Section id="s4" num={4} title="How threadIdx and blockIdx map to global (row, col)"
          visual={
            <div className="space-y-4">
              <div className="border border-[#dccfb2] p-4 font-mono text-[12px] space-y-2">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-3">Index Calculation — blockIdx=(2,1), threadIdx=(3,2)</div>
                <div className="text-[#5e4a30]">TILE_SIZE = <span className="text-[#2a1c0d] font-bold">4</span></div>
                <div className="text-[#5e4a30]">blockIdx.x = <span className="text-[#2a1c0d] font-bold">2</span>,  blockIdx.y = <span className="text-[#2a1c0d] font-bold">1</span></div>
                <div className="text-[#5e4a30]">threadIdx.x = <span className="text-[#2a1c0d] font-bold">3</span>,  threadIdx.y = <span className="text-[#2a1c0d] font-bold">2</span></div>
                <div className="border-t border-[#dccfb2] pt-2">
                  <div className="text-[#5e4a30]">row = 1 × 4 + 2 = <span className="text-[#2a1c0d] font-bold">6</span></div>
                  <div className="text-[#5e4a30]">col = 2 × 4 + 3 = <span className="text-[#2a1c0d] font-bold">11</span></div>
                </div>
                <div className="border border-[#2a1c0d] p-2 text-[#2a1c0d] font-bold">
                  → This thread computes C[6][11]
                </div>
              </div>
              <div className="border border-[#dccfb2] p-3 text-[11px] font-mono text-[#5e4a30]">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Block Coverage</div>
                <div>blockIdx=(2,1) starts at row={1*4}, col={2*4}</div>
                <div className="text-[#967f5e]">covers C rows 4–7, cols 8–11</div>
              </div>
            </div>
          }
        >
          <P>The first two lines of the kernel establish each thread's <em>global position</em> in C:</P>
          <Pre>{`int row = blockIdx.y * TILE_SIZE + threadIdx.y;
int col = blockIdx.x * TILE_SIZE + threadIdx.x;`}</Pre>
          <P><Code>blockIdx.y</Code> tells which group of rows this block covers. Multiply by TILE_SIZE to get the starting row. Then add <Code>threadIdx.y</Code> to get <em>this thread's specific row</em>. Same logic for columns.</P>
          <Pre>{`blockIdx.y = 1
blockIdx.x = 2

Block starts at:
  row = 1 × 4 = 4
  col = 2 × 4 = 8

Thread (ty=2, tx=3) inside this block:
  row = 4 + 2 = 6
  col = 8 + 3 = 11
  → computes C[6][11]`}</Pre>
          <P>Every thread in the entire grid computes a unique <Code>(row, col)</Code> pair this way — no two threads ever write to the same cell.</P>
        </Section>

        {/* ── 5. Shared memory ────────────────────────────────────────── */}
        <Section id="s5" num={5} title="Shared memory: the fast scratch pad"
          visual={
            <div className="space-y-4">
              <div className="flex gap-8">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">sA[4][4]</div>
                  <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(4, 36px)` }}>
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} className="w-9 h-9 flex items-center justify-center text-[11px] font-mono border border-dashed border-[#bfad88] text-[#cbbb98]">?</div>
                    ))}
                  </div>
                  <div className="text-[9px] font-mono text-[#bfad88]">64 bytes on-chip</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">sB[4][4]</div>
                  <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(4, 36px)` }}>
                    {Array.from({ length: 16 }, (_, i) => (
                      <div key={i} className="w-9 h-9 flex items-center justify-center text-[11px] font-mono border border-dashed border-[#bfad88] text-[#cbbb98]">?</div>
                    ))}
                  </div>
                  <div className="text-[9px] font-mono text-[#bfad88]">64 bytes on-chip</div>
                </div>
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Memory Latency</div>
                <div className="flex justify-between"><span className="text-[#5e4a30]">Global DRAM</span><span className="text-[#d44] font-semibold">~400 ns</span></div>
                <div className="flex justify-between"><span className="text-[#5e4a30]">L2 Cache</span><span className="text-[#967f5e]">~100 ns</span></div>
                <div className="flex justify-between"><span className="text-[#5e4a30]">Shared Memory</span><span className="text-[#2a1c0d] font-bold">~5 ns (80×)</span></div>
              </div>
              <div className="border border-[#2a1c0d] p-3 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Without vs With</div>
                <div className="text-[#5e4a30]">Naive: 16 threads × N global reads</div>
                <div className="text-[#5e4a30]">Tiled: 16 global reads → all threads share</div>
              </div>
            </div>
          }
        >
          <P>Immediately after calculating row and col, the kernel declares two <strong>shared memory arrays</strong>:</P>
          <Pre>{`__shared__ float sA[TILE_SIZE][TILE_SIZE];
__shared__ float sB[TILE_SIZE][TILE_SIZE];`}</Pre>
          <P>The <Code>__shared__</Code> keyword places these arrays in the GPU's <em>on-chip SRAM</em>, which is physically next to the compute units — roughly 80× faster than reading from global DRAM.</P>
          <P>All 16 threads in the block <strong>share the same sA and sB</strong>. This is the fundamental trick: instead of each of the 16 threads independently reading the same data from slow global memory, they cooperatively load it once into shared memory and then all read from the fast copy.</P>
          <Note>Shared memory is <em>per block</em>. Two different blocks have completely separate sA and sB. It is NOT shared across the whole GPU.</Note>
          <Pre>{`Without shared memory:
  16 threads × 4 reads/tile = 64 global reads per tile

With shared memory:
  16 global reads (cooperative load)
  + 64 fast shared reads (for computation)
  → 75% fewer slow reads per tile`}</Pre>
        </Section>

        {/* ── 6. The t-loop ────────────────────────────────────────────── */}
        <Section id="s6" num={6} title="Why the t-loop?"
          visual={
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <MatrixGrid label="A — t=0 (cols 0–3)" data={A}
                  highlightTileRow={0} highlightTileCol={0} dimOutsideTile />
                <MatrixGrid label="B — t=0 (rows 0–3)" data={B}
                  highlightTileRow={0} highlightTileCol={0} dimOutsideTile />
              </div>
              <div className="flex gap-4 flex-wrap">
                <MatrixGrid label="A — t=1 (cols 4–7)" data={A}
                  highlightTileRow={0} highlightTileCol={1} dimOutsideTile />
                <MatrixGrid label="B — t=1 (rows 4–7)" data={B}
                  highlightTileRow={1} highlightTileCol={0} dimOutsideTile />
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">C[0..3][0..3] accumulation</div>
                <div className="text-[#5e4a30]">t=0: C += A[0..3][0..3] × B[0..3][0..3]</div>
                <div className="text-[#5e4a30]">t=1: C += A[0..3][4..7] × B[4..7][0..3]</div>
                <div className="text-[#2a1c0d] font-bold mt-1">C[top-left] = sum of both</div>
              </div>
            </div>
          }
        >
          <P>sA and sB only hold a 4×4 tile. But to compute one output element of C, we need the <em>full row</em> of A (8 elements) crossed with the <em>full column</em> of B (8 elements). So we loop:</P>
          <Pre>{`for (int t = 0; t < (N + TILE_SIZE - 1) / TILE_SIZE; t++) {
    // t=0: load columns 0-3 of A, rows 0-3 of B
    // t=1: load columns 4-7 of A, rows 4-7 of B
    // ... each time accumulate into sum
}`}</Pre>
          <P>Think of it this way. To compute the top-left 4×4 tile of C (call it C00), you need:</P>
          <Pre>{`C00 = A00 × B00   +   A01 × B10

where:
  A00 = top-left 4×4 of A    (rows 0-3, cols 0-3)
  A01 = top-right 4×4 of A   (rows 0-3, cols 4-7)
  B00 = top-left 4×4 of B    (rows 0-3, cols 0-3)
  B10 = bottom-left 4×4 of B (rows 4-7, cols 0-3)`}</Pre>
          <P>The visual shows both iterations side-by-side. On each iteration <Code>t</Code>, we load one pair of tiles into sA/sB, compute partial sums, then advance to the next pair. The variable <Code>sum</Code> accumulates across all iterations.</P>
        </Section>

        {/* ── 7. Load A ─────────────────────────────────────────────────── */}
        <Section id="s7" num={7} title="Step 1 in the loop: load a tile of A into sA"
          visual={
            <div className="space-y-4">
              <div className="flex gap-6 flex-wrap items-start">
                <MatrixGrid label="Global memory — A (t=0 tile highlighted)" data={A}
                  highlightTileRow={0} highlightTileCol={0} dimOutsideTile />
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">→ sA after load</div>
                  <TileGrid4 label="sA[4][4]" data={sA0} highlightRow={0} />
                  <div className="text-[9px] font-mono text-[#b3a07a] mt-1">row 0 highlighted (thread ty=0 loaded it)</div>
                </div>
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">What each thread loads</div>
                {[0,1,2,3].map(ty => (
                  <div key={ty} className="text-[#765f41]">
                    ty={ty}: sA[{ty}][tx] = A[row={ty}][t×4+tx]  <span className="text-[#bfad88]">← 4 values</span>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <P>Each thread loads exactly <strong>one element</strong> from A into shared memory:</P>
          <Pre>{`sA[threadIdx.y][threadIdx.x] =
    A[row * N + t * TILE_SIZE + threadIdx.x];`}</Pre>
          <P>Let's trace thread <Code>(ty=0, tx=0)</Code> through <Code>(ty=3, tx=3)</Code> on iteration t=0:</P>
          <Pre>{`thread (0,0) → sA[0][0] = A[0][0] = 2
thread (0,1) → sA[0][1] = A[0][1] = 0
thread (0,2) → sA[0][2] = A[0][2] = 1
thread (0,3) → sA[0][3] = A[0][3] = 3
thread (1,0) → sA[1][0] = A[1][0] = 1
...
thread (3,3) → sA[3][3] = A[3][3] = 2`}</Pre>
          <P>After all 16 threads execute this line, <strong>sA holds the entire 4×4 tile of A</strong>. Each thread did one global read and one shared write.</P>
          <Note><strong>Coalescing:</strong> consecutive threads (varying tx) access consecutive memory addresses (A[row][t×4+0], A[row][t×4+1], ...). The GPU can satisfy this with a single memory transaction.</Note>
        </Section>

        {/* ── 8. Load B ─────────────────────────────────────────────────── */}
        <Section id="s8" num={8} title="Step 2: load a tile of B into sB"
          visual={
            <div className="space-y-4">
              <div className="flex gap-6 flex-wrap items-start">
                <MatrixGrid label="Global memory — B (t=0 tile highlighted)" data={B}
                  highlightTileRow={0} highlightTileCol={0} dimOutsideTile />
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">→ sB after load</div>
                  <TileGrid4 label="sB[4][4]" data={sB0} highlightCol={0} />
                  <div className="text-[9px] font-mono text-[#b3a07a] mt-1">col 0 highlighted (threads with tx=0 loaded it)</div>
                </div>
              </div>
            </div>
          }
        >
          <P>Simultaneously (in the same kernel line), each thread loads one element from B:</P>
          <Pre>{`sB[threadIdx.y][threadIdx.x] =
    B[(t * TILE_SIZE + threadIdx.y) * N + col];`}</Pre>
          <P>Now both sA and sB are populated. The block's 16 threads collectively loaded 32 values from global memory — 16 for A, 16 for B. These 32 values will power the 64 multiplications in the compute step.</P>
          <Pre>{`After t=0 loads:

sA                     sB

┌──┬──┬──┬──┐         ┌──┬──┬──┬──┐
│ 2│ 0│ 1│ 3│         │ 1│ 2│ 0│ 1│
├──┼──┼──┼──┤         ├──┼──┼──┼──┤
│ 1│ 2│ 0│ 1│         │ 0│ 1│ 3│ 2│
├──┼──┼──┼──┤         ├──┼──┼──┼──┤
│ 3│ 1│ 2│ 0│         │ 2│ 0│ 1│ 0│
├──┼──┼──┼──┤         ├──┼──┼──┼──┤
│ 0│ 3│ 1│ 2│         │ 1│ 3│ 2│ 1│
└──┴──┴──┴──┘         └──┴──┴──┴──┘`}</Pre>
        </Section>

        {/* ── 9. Barrier 1 ─────────────────────────────────────────────── */}
        <Section id="s9" num={9} title="__syncthreads() — Barrier 1: wait before computing"
          visual={
            <div className="space-y-4">
              <ThreadBlock />
              <div className="border border-[#2a1c0d] p-3 text-center font-mono">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Block-Wide Barrier</div>
                <div className="text-[#2a1c0d] font-bold">__syncthreads()</div>
                <div className="text-[#5e4a30] text-[10px] mt-1">all 16 threads must arrive before any can proceed</div>
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Without barrier — data race</div>
                <div className="text-[#d44]">Thread (0,0) starts computing sA[0][3]</div>
                <div className="text-[#d44]">Thread (3,3) is still writing to sA[3][3]</div>
                <div className="text-[#2a1c0d] mt-1">→ Thread (0,0) reads garbage</div>
              </div>
            </div>
          }
        >
          <P>After loading both tiles, we hit the first <Code>__syncthreads()</Code>:</P>
          <Pre>{`sA[ty][tx] = A[...];    // thread loads its element
sB[ty][tx] = B[...];    // thread loads its element
__syncthreads();         // ← WAIT HERE`}</Pre>
          <P>This is a <strong>block-wide barrier</strong>. No thread can proceed past this line until <em>every single thread in the block</em> has reached it. It forces a full memory fence — all shared memory writes become visible to all threads.</P>
          <P>Imagine 16 people filling a whiteboard, one cell each. You cannot start doing math until every person has finished writing. <Code>__syncthreads()</Code> is the moment everyone puts their marker down.</P>
          <Pre>{`Timeline:
Thread 0  [load A][load B]─────────────┐
Thread 1  [load A][load B]──────┐       │
Thread 2  [load A][load B]─┐    │       │
...                         │    │       │
                           ─┴────┴───────┴─ BARRIER
                                             ↓
                                        [compute]`}</Pre>
          <Note>Without this barrier, a fast thread might read sA[3][3] while a slow thread is still writing it. This is a classic GPU race condition — the result would be unpredictable and wrong.</Note>
        </Section>

        {/* ── 10. Dot product ──────────────────────────────────────────── */}
        <Section id="s10" num={10} title="The inner loop: dot product from shared memory"
          visual={
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <TileGrid4 label="sA[4][4] — row 1 in use" data={sA0} highlightRow={1} activeCell={{ r: 1, c: 2 }} />
                <TileGrid4 label="sB[4][4] — col 2 in use" data={sB0} highlightCol={2} activeCell={{ r: 2, c: 2 }} />
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Thread (ty=1, tx=2) — computing C[1][2]</div>
                {(() => {
                  let runSum = 0;
                  return [0,1,2,3].map(k => {
                    const a = sA0[1][k], b = sB0[k][2], p = a * b;
                    runSum += p;
                    return (
                      <div key={k} className="text-[#765f41]">
                        k={k}: sA[1][{k}]×sB[{k}][2] = {a}×{b} = {p}  → sum={runSum}
                      </div>
                    );
                  });
                })()}
                <div className="text-[#2a1c0d] font-bold border-t border-[#dccfb2] mt-1 pt-1">
                  partial sum (tile 0) = {[0,1,2,3].reduce((s,k) => s + sA0[1][k]*sB0[k][2], 0)}
                </div>
              </div>
            </div>
          }
        >
          <P>Now comes the actual computation. Each thread runs its own 4-iteration inner loop:</P>
          <Pre>{`for (int k = 0; k < TILE_SIZE; k++)
    sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];`}</Pre>
          <P>Let's follow thread <Code>(ty=1, tx=2)</Code>, responsible for <Code>C[1][2]</Code>. It uses <strong>row 1 of sA</strong> and <strong>column 2 of sB</strong>:</P>
          <Pre>{`k=0: sA[1][0] × sB[0][2] = 1×0 = 0  → sum=0
k=1: sA[1][1] × sB[1][2] = 2×3 = 6  → sum=6
k=2: sA[1][2] × sB[2][2] = 0×1 = 0  → sum=6
k=3: sA[1][3] × sB[3][2] = 1×2 = 2  → sum=8`}</Pre>
          <P>The highlighted cells in the visual show the active sA and sB elements at each k. All 16 threads do this simultaneously — each uses a different row of sA and/or column of sB, so they never conflict. All reads are from shared memory (~5 ns each).</P>
          <Note>This is why shared memory is so powerful: the 16 threads share sA and sB. Thread (0,2) and thread (1,2) both read sB column 2 — but from shared memory, which handles simultaneous access efficiently via broadcast.</Note>
        </Section>

        {/* ── 11. Barrier 2 ────────────────────────────────────────────── */}
        <Section id="s11" num={11} title="__syncthreads() — Barrier 2: before overwriting"
          visual={
            <div className="space-y-4">
              <div className="border border-[#2a1c0d] p-4 font-mono text-[11px] space-y-3">
                <div>
                  <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Loop iteration t=0</div>
                  <div className="text-[#5e4a30]">Load tile → __syncthreads() → Compute</div>
                </div>
                <div className="text-center text-[#bfad88]">↓</div>
                <div className="border border-[#2a1c0d] p-2 text-center text-[#2a1c0d] font-bold">__syncthreads()  ← Barrier 2</div>
                <div className="text-center text-[#bfad88]">↓</div>
                <div>
                  <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Loop iteration t=1</div>
                  <div className="text-[#5e4a30]">Overwrite sA/sB → __syncthreads() → Compute</div>
                </div>
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">The two barriers</div>
                <div className="text-[#5e4a30]">Barrier 1: tile <span className="text-[#2a1c0d] font-semibold">loaded</span> → safe to read</div>
                <div className="text-[#5e4a30]">Barrier 2: tile <span className="text-[#2a1c0d] font-semibold">consumed</span> → safe to overwrite</div>
              </div>
            </div>
          }
        >
          <P>After the inner k-loop, before the next tile iteration overwrites sA and sB, there is a second barrier:</P>
          <Pre>{`    for (int k = 0; k < TILE_SIZE; k++)
        sum += sA[ty][k] * sB[k][tx];

    __syncthreads();   // ← Barrier 2
}  // end of t-loop, now t++ and loop again`}</Pre>
          <P>Why? Consider thread (0,0) — it might finish its k-loop very quickly and immediately try to load the <em>next</em> tile's data into sA. But thread (3,3) might still be in the middle of reading sA[3][2] for its k=2 iteration.</P>
          <P>Without this barrier, thread (0,0) would overwrite shared memory with t=1 tile data while thread (3,3) is still reading t=0 data. The result: thread (3,3) reads the wrong values.</P>
          <Pre>{`Two barriers, two different jobs:

LOAD TILE
   ↓
__syncthreads()  ← "all loading is done"
   ↓
USE TILE
   ↓
__syncthreads()  ← "all reading is done"
   ↓
LOAD NEXT TILE`}</Pre>
          <Note>Both barriers are mandatory. Removing either one introduces a race condition that produces wrong answers silently — CUDA will not warn you.</Note>
        </Section>

        {/* ── 12. Next tile ─────────────────────────────────────────────── */}
        <Section id="s12" num={12} title="t=1: load the next pair of tiles and accumulate"
          visual={
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <MatrixGrid label="A — t=1 tile (cols 4–7)" data={A}
                  highlightTileRow={0} highlightTileCol={1} dimOutsideTile />
                <MatrixGrid label="B — t=1 tile (rows 4–7)" data={B}
                  highlightTileRow={1} highlightTileCol={0} dimOutsideTile />
              </div>
              <div className="flex gap-4 flex-wrap">
                <TileGrid4 label="sA[4][4] — now holds cols 4-7" data={sA1} />
                <TileGrid4 label="sB[4][4] — now holds rows 4-7" data={sB1} />
              </div>
              <div className="border border-[#dccfb2] p-3 font-mono text-[11px] space-y-0.5">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-1">Thread (1,2) accumulation</div>
                <div className="text-[#5e4a30]">After t=0: sum = {[0,1,2,3].reduce((s,k) => s + sA0[1][k]*sB0[k][2], 0)}</div>
                <div className="text-[#5e4a30]">After t=1: sum = {[0,1,2,3].reduce((s,k) => s + sA0[1][k]*sB0[k][2], 0) + [0,1,2,3].reduce((s,k) => s + sA1[1][k]*sB1[k][2], 0)} (final)</div>
                <div className="text-[#967f5e] text-[10px] mt-1">= C[1][2] = {Cmat[1][2]}</div>
              </div>
            </div>
          }
        >
          <P>After Barrier 2, the loop increments <Code>t</Code> and repeats. Now sA is overwritten with the <em>second 4×4 block of A's row</em> (columns 4–7) and sB with the second block of B's column (rows 4–7).</P>
          <Pre>{`t=0: sA ← A[0..3][0..3],  sB ← B[0..3][0..3]
     sum += sA × sB  (partial dot product)

t=1: sA ← A[0..3][4..7],  sB ← B[4..7][0..3]
     sum += sA × sB  (second partial sum)`}</Pre>
          <P>For an 8×8 matrix, two tile iterations fully cover the row of A and column of B. For a 4096×4096 matrix, there would be 4096/TILE_SIZE = 256 iterations — but the structure is identical.</P>
          <P>By the end of the t-loop, <Code>sum</Code> holds the complete dot product for this thread's output cell. Every thread reaches this point simultaneously with its own correct sum.</P>
        </Section>

        {/* ── 13. Write ─────────────────────────────────────────────────── */}
        <Section id="s13" num={13} title="Write the result to C"
          visual={
            <div className="space-y-4">
              <div className="border border-[#2a1c0d] p-4 font-mono text-[12px] space-y-2">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">Final Write</div>
                <div className="text-[#5e4a30]">if (row &lt; N &amp;&amp; col &lt; N)</div>
                <div className="text-[#5e4a30]">    C[row * N + col] = sum;</div>
                <div className="mt-3 text-[#5e4a30]">Thread (ty=1, tx=2) of block (0,0):</div>
                <div className="text-[#2a1c0d] font-bold">row=1, col=2</div>
                <div className="text-[#2a1c0d] font-bold">C[1×8+2] = C[10] = {Cmat[1][2]}</div>
              </div>
              <MatrixGrid label="C — final result" data={Cmat} size={8}
                highlightCell={{ r: 1, c: 2 }} />
            </div>
          }
        >
          <P>After the t-loop completes, each thread writes its accumulated sum to global memory:</P>
          <Pre>{`if (row < N && col < N)
    C[row * N + col] = sum;`}</Pre>
          <P>The bounds check <Code>row &lt; N &amp;&amp; col &lt; N</Code> is important. When N is not divisible by TILE_SIZE, the last block extends beyond the matrix. Threads in the "overflow" zone simply do nothing — they don't write, so they don't corrupt memory.</P>
          <P>This single write per thread is the only global memory <em>write</em> in the whole kernel. Each of the 64 threads writes exactly one float. These writes are coalesced — consecutive threads (same ty, varying tx) write to consecutive addresses.</P>
          <Note>A safe production version also zero-pads sA/sB during loading for out-of-bounds indices, to prevent reading garbage in the partial tiles at the edges.</Note>
        </Section>

        {/* ── 14. Summary ──────────────────────────────────────────────── */}
        <Section id="s14" num={14} title="The complete picture"
          visual={
            <div className="space-y-3">
              <div className="border border-[#2a1c0d] p-4 font-mono text-[11px] space-y-1">
                <div className="text-[10px] text-[#967f5e] uppercase tracking-widest mb-2">One block, one 4×4 tile of C</div>
                {[
                  ["sig",  "1. row = blockIdx.y×T + threadIdx.y"],
                  ["sig",  "2. col = blockIdx.x×T + threadIdx.x"],
                  ["init", "3. sum = 0"],
                  ["loop", "4. for t = 0 .. N/T-1:"],
                  ["ldA",  "     a. sA[ty][tx] = A[row][t×T+tx]"],
                  ["ldB",  "     b. sB[ty][tx] = B[t×T+ty][col]"],
                  ["sync1","     c. __syncthreads()  ← barrier 1"],
                  ["mac",  "     d. sum += sA[ty][k]×sB[k][tx] for k"],
                  ["sync2","     e. __syncthreads()  ← barrier 2"],
                  ["wr",   "5. C[row][col] = sum"],
                ].map(([tag, line], i) => (
                  <div key={i} className={`${["ldA","ldB","mac"].includes(tag) ? "ml-4" : ""} ${tag === "wr" ? "text-[#2a1c0d] font-bold" : "text-[#5e4a30]"}`}>
                    {line}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-[#dccfb2] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase">Naive global reads</div>
                  <div className="text-xl font-heading font-bold text-[#967f5e] mt-1">2N²</div>
                  <div className="text-[9px] font-mono text-[#bfad88]">per output tile</div>
                </div>
                <div className="border border-[#2a1c0d] p-3 text-center bg-[#f3eadb]">
                  <div className="text-[10px] font-mono text-[#967f5e] uppercase">Tiled global reads</div>
                  <div className="text-xl font-heading font-bold text-[#2a1c0d] mt-1">2N²/T</div>
                  <div className="text-[9px] font-mono text-[#bfad88]">T× fewer global reads</div>
                </div>
              </div>
            </div>
          }
        >
          <P>In one sentence: each CUDA block computes a <strong>4×4 chunk of C</strong> by repeatedly loading 4×4 chunks of A and B into shared memory, multiplying them, accumulating the result, and finally writing 16 answers back to global memory.</P>
          <Pre>{`                GLOBAL MEMORY

            A                B
            │                │
            │ load tiles     │
            ▼                ▼
       ┌─────────┐      ┌─────────┐
       │   sA    │      │   sB    │
       │  4 × 4  │      │  4 × 4  │
       └─────────┘      └─────────┘
             │                │
             └───────┬────────┘
                     ▼
              __syncthreads()
                     ▼
             ┌───────────────┐
             │ 16 threads    │
             │ each computes │
             │ one C element │
             └───────────────┘
                     ▼
              __syncthreads()
                     ▼
                next tile
                     ▼
                  repeat`}</Pre>
          <P>The key numbers to remember:</P>
          <Pre>{`Naive:  each thread reads 2N global values
Tiled:  block reads 2N/T global values (shared)
        → T× reduction in global memory traffic

For T=16: 16× fewer DRAM reads
For T=32: 32× fewer DRAM reads`}</Pre>
          <P>This is why the tiled kernel achieves ~30% of peak GPU performance while the naive kernel achieves only ~2%. The compute hardware is the same — the bottleneck shifts from memory bandwidth to arithmetic.</P>
        </Section>

      </div>
    </div>
  );
}
