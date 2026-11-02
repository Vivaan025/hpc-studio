"use client";

import { useState, useRef, useEffect } from "react";
import SimulationControls from "./SimulationControls";
import SimulationCodePanel from "./SimulationCodePanel";

const K = (s: string) => `<span style="font-weight:700">${s}</span>`;
const TY = (s: string) => `<span style="color:#5e4a30">${s}</span>`;
const F = (s: string) => `<span style="font-weight:600">${s}</span>`;
const CM = (s: string) => `<span style="color:#967f5e;font-style:italic">${s}</span>`;

const CODE = [
  { tag: "stream", html: `cudaStream_t s;  cudaStreamCreate(&s);` },
  { tag: "decl",   html: `cudaGraph_t graph;  cudaGraphExec_t exec;` },
  { tag: "",       html: `` },
  { tag: "begin",  html: `${F("cudaStreamBeginCapture")}(s, cudaStreamCaptureModeGlobal);` },
  { tag: "k1",     html: `scale&lt;&lt;&lt;blocks, 256, 0, s&gt;&gt;&gt;(d, 0.999f, N);     ${CM("// recorded, not run")}` },
  { tag: "k2",     html: `add_bias&lt;&lt;&lt;blocks, 256, 0, s&gt;&gt;&gt;(d, 0.01f, N);` },
  { tag: "k3",     html: `relu&lt;&lt;&lt;blocks, 256, 0, s&gt;&gt;&gt;(d, N);` },
  { tag: "end",    html: `${F("cudaStreamEndCapture")}(s, &graph);` },
  { tag: "",       html: `` },
  { tag: "inst",   html: `${F("cudaGraphInstantiate")}(&exec, graph, 0);` },
  { tag: "",       html: `` },
  { tag: "loop",   html: `${K("for")} (${TY("int")} it = 0; it &lt; 1000; ++it)` },
  { tag: "launch", html: `    ${F("cudaGraphLaunch")}(exec, s);                  ${CM("// one call, three kernels")}` },
  { tag: "sync",   html: `cudaStreamSynchronize(s);` },
];

type Phase = "idle" | "capturing" | "captured" | "instantiated" | "launching" | "done";

interface Step {
  label: string;
  desc: string;
  tags: string[];
  phase: Phase;
  nodes: number;          // how many nodes exist in the graph (0..3)
  launches: number;       // how many graph launches have been issued
  gpuKernels: number;     // how many kernels have actually executed on the GPU
  runningKernel?: number; // 0..2, which kernel is currently executing
}

const KERNELS = ["scale", "add_bias", "relu"];

const STEPS: Step[] = [
  { label: "Create a stream", desc: "Nothing special yet. A stream is just an ordered queue of GPU work. We'll use it as our tape recorder.", tags: ["stream", "decl"], phase: "idle", nodes: 0, launches: 0, gpuKernels: 0 },
  { label: "Begin capture", desc: "From this line on, the stream is in recording mode. Anything you enqueue on it is written down instead of executed.", tags: ["begin"], phase: "capturing", nodes: 0, launches: 0, gpuKernels: 0 },
  { label: "Launch scale → becomes node 1", desc: "This looks exactly like a normal kernel launch. But the GPU does nothing. CUDA adds a kernel node to the graph with the grid size, arguments, and pointer baked in.", tags: ["k1"], phase: "capturing", nodes: 1, launches: 0, gpuKernels: 0 },
  { label: "Launch add_bias → node 2", desc: "Because both launches are on the same stream, CUDA knows add_bias must run after scale. It draws a dependency edge from node 1 to node 2.", tags: ["k2"], phase: "capturing", nodes: 2, launches: 0, gpuKernels: 0 },
  { label: "Launch relu → node 3", desc: "Same story. Three launches on one stream become a straight chain of three nodes. Still zero GPU work has happened.", tags: ["k3"], phase: "capturing", nodes: 3, launches: 0, gpuKernels: 0 },
  { label: "End capture", desc: "Recording stops and we get a cudaGraph_t: a description of the work. Think of it as the recipe, not the meal.", tags: ["end"], phase: "captured", nodes: 3, launches: 0, gpuKernels: 0 },
  { label: "Instantiate", desc: "CUDA validates the graph, allocates whatever it needs, and compiles it into an executable form (cudaGraphExec_t). This is the slow, one-time step. Do it once, outside your hot loop.", tags: ["inst"], phase: "instantiated", nodes: 3, launches: 0, gpuKernels: 0 },
  { label: "Launch #1 → scale runs", desc: "One cudaGraphLaunch call. The CPU hands the whole graph to the GPU in one go and moves on. The GPU starts with node 1.", tags: ["loop", "launch"], phase: "launching", nodes: 3, launches: 1, gpuKernels: 1, runningKernel: 0 },
  { label: "Launch #1 → add_bias runs", desc: "The GPU follows the edge to node 2. No CPU involvement. The dependency was resolved at instantiate time, so there is no scheduling decision to make now.", tags: ["launch"], phase: "launching", nodes: 3, launches: 1, gpuKernels: 2, runningKernel: 1 },
  { label: "Launch #1 → relu runs", desc: "Node 3 runs. That is one full replay of the graph: three kernels for the price of one launch call.", tags: ["launch"], phase: "launching", nodes: 3, launches: 1, gpuKernels: 3, runningKernel: 2 },
  { label: "Launch #2", desc: "Replay again. Same pointers, same arguments, same three kernels. The CPU cost of this line is roughly 1 µs per node instead of 10+ µs per kernel launch.", tags: ["loop", "launch"], phase: "launching", nodes: 3, launches: 2, gpuKernels: 6 },
  { label: "Launch #3 … #1000", desc: "And so on, a thousand times. The graph never changes, so it never needs to be re-captured or re-instantiated.", tags: ["loop", "launch"], phase: "launching", nodes: 3, launches: 1000, gpuKernels: 3000 },
  { label: "Synchronize", desc: "Wait for the GPU to drain the queue. Done: 3000 kernels executed, 1000 launch calls made, 1 capture, 1 instantiate.", tags: ["sync"], phase: "done", nodes: 3, launches: 1000, gpuKernels: 3000 },
];

export default function GraphCaptureSimulation() {
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next >= STEPS.length) { setPlaying(false); return prev; }
        return next;
      });
    }, 2200 - speed * 180);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed]);

  const cur = idx >= 0 ? STEPS[idx] : null;
  const phase: Phase = cur?.phase ?? "idle";
  const nodes = cur?.nodes ?? 0;

  const boxBase = "border p-3 transition-all duration-300";
  const activeBox = "border-[#2a1c0d] bg-white";
  const dimBox = "border-[#dccfb2] bg-[#f3eadb] text-[#b3a07a]";

  return (
    <div className="space-y-5">
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Step info */}
          <div className="border border-[#dccfb2] p-3">
            <div className="text-xs font-mono text-[#967f5e] mb-1">{cur ? `step ${idx + 1}/${STEPS.length}` : "ready"}</div>
            <div className="text-sm font-semibold text-[#2a1c0d] mb-1">{cur?.label || "Press RUN to start"}</div>
            <div className="text-xs text-[#5e4a30] leading-relaxed">{cur?.desc || "Watch three ordinary kernel launches turn into a graph, then get replayed 1000 times."}</div>
          </div>

          {/* Pipeline: stream → graph → exec → GPU */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.7fr_1fr] gap-3">
            {/* Stream */}
            <div className={`${boxBase} ${phase === "idle" || phase === "capturing" ? activeBox : dimBox}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest">Stream s</span>
                {phase === "capturing" && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-[#2a1c0d]">
                    <span className="w-2 h-2 rounded-full bg-[#2a1c0d] animate-pulse" /> REC
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono leading-relaxed">
                {phase === "idle" && <span className="text-[#967f5e]">empty queue</span>}
                {phase === "capturing" && <span>recording launches…</span>}
                {phase !== "idle" && phase !== "capturing" && <span>capture finished</span>}
              </div>
            </div>

            {/* Graph */}
            <div className={`${boxBase} ${nodes > 0 ? activeBox : dimBox}`}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2">cudaGraph_t</div>
              <div className="flex items-center gap-1 flex-wrap">
                {KERNELS.map((k, i) => (
                  <div key={k} className="flex items-center gap-1">
                    <div
                      className={`px-1.5 py-1 text-[10px] font-mono border transition-all duration-300 whitespace-nowrap ${
                        i < nodes ? "bg-[#2a1c0d] text-white border-[#2a1c0d]" : "border-dashed border-[#cbbb98] text-[#bfad88]"
                      }`}
                    >
                      {k}
                    </div>
                    {i < KERNELS.length - 1 && (
                      <span className={`text-[10px] ${i + 1 < nodes ? "text-[#2a1c0d]" : "text-[#cbbb98]"}`}>→</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono text-[#967f5e] mt-2">{nodes} node{nodes === 1 ? "" : "s"}{phase === "captured" || phase === "instantiated" || phase === "launching" || phase === "done" ? " · sealed" : ""}</div>
            </div>

            {/* Exec */}
            <div className={`${boxBase} ${phase === "instantiated" || phase === "launching" || phase === "done" ? activeBox : dimBox}`}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2">cudaGraphExec_t</div>
              <div className="text-[11px] font-mono leading-relaxed">
                {phase === "instantiated" || phase === "launching" || phase === "done" ? (
                  <>
                    <div>ready to launch</div>
                    <div className="text-[#967f5e]">launches: {cur?.launches ?? 0}</div>
                  </>
                ) : (
                  <span>not instantiated</span>
                )}
              </div>
            </div>
          </div>

          {/* GPU lane */}
          <div className="border border-[#dccfb2] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-[#967f5e] uppercase tracking-widest">GPU</span>
              <span className="text-[10px] font-mono text-[#967f5e]">kernels executed: {cur?.gpuKernels ?? 0}</span>
            </div>
            <div className="flex items-center gap-[2px] h-8">
              {phase === "launching" || phase === "done" ? (
                <>
                  {[0, 1, 2].map((i) => {
                    const launched = (cur?.launches ?? 0) > 1 || (cur?.gpuKernels ?? 0) > i;
                    const running = cur?.runningKernel === i;
                    return (
                      <div
                        key={i}
                        className={`h-full flex-1 flex items-center justify-center text-[10px] font-mono border transition-all duration-300 ${
                          running ? "bg-[#2a1c0d] text-white border-[#2a1c0d] scale-y-110" : launched ? "bg-[#41301c] text-white border-[#41301c]" : "border-dashed border-[#cbbb98] text-[#bfad88]"
                        }`}
                      >
                        {KERNELS[i]}
                      </div>
                    );
                  })}
                  {(cur?.launches ?? 0) > 1 && (
                    <div className="h-full px-3 flex items-center text-[10px] font-mono text-[#967f5e] border border-dashed border-[#cbbb98]">
                      × {cur?.launches}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-[#b3a07a] border border-dashed border-[#dccfb2]">
                  {phase === "capturing" ? "idle — launches are being recorded, not executed" : "idle"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[420px] flex-shrink-0">
          <SimulationCodePanel lines={CODE} highlightTags={cur?.tags || []} filename="graph_bench.cu (excerpt)" />
        </div>
      </div>

      <SimulationControls
        isPlaying={playing}
        onPlay={() => { if (idx >= STEPS.length - 1 || idx < 0) setIdx(0); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onStep={() => { setPlaying(false); setIdx((p) => Math.min(p + 1, STEPS.length - 1)); }}
        onBack={() => { setPlaying(false); setIdx((p) => Math.max(p - 1, -1)); }}
        onReset={() => { setPlaying(false); setIdx(-1); }}
        currentStep={Math.max(0, idx)}
        totalSteps={STEPS.length}
        speed={speed}
        onSpeedChange={setSpeed}
        statusText={cur?.label || "Press RUN to start"}
      />
    </div>
  );
}
