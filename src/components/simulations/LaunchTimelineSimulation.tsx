"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import SimulationControls from "./SimulationControls";

// Numbers come from the measured run on an RTX 3050 laptop (Windows, CUDA 12.6):
//   ~11 µs CPU cost per plain kernel launch
//   ~1 µs CPU cost per node when launching a graph
//   ~1.7 µs GPU time per kernel (16K floats)
const KERNEL_US = 1.7;
const STREAM_LAUNCH_US = 11;
const GRAPH_PER_NODE_US = 1;
const NUM_KERNELS = 6;
const KERNEL_NAMES = ["scale", "add_bias", "relu", "scale", "add_bias", "relu"];

interface Bar { start: number; end: number; label: string; kind: "cpu" | "gpu" | "idle" }

function buildTimeline(mode: "stream" | "graph") {
  const cpu: Bar[] = [];
  const gpu: Bar[] = [];
  if (mode === "stream") {
    let gpuFree = 0;
    for (let i = 0; i < NUM_KERNELS; i++) {
      const s = i * STREAM_LAUNCH_US;
      const e = s + STREAM_LAUNCH_US;
      cpu.push({ start: s, end: e, label: `launch ${KERNEL_NAMES[i]}`, kind: "cpu" });
      const gs = Math.max(e, gpuFree);
      if (gs > gpuFree) gpu.push({ start: gpuFree, end: gs, label: "idle", kind: "idle" });
      gpu.push({ start: gs, end: gs + KERNEL_US, label: KERNEL_NAMES[i], kind: "gpu" });
      gpuFree = gs + KERNEL_US;
    }
  } else {
    const launchEnd = NUM_KERNELS * GRAPH_PER_NODE_US;
    cpu.push({ start: 0, end: launchEnd, label: "cudaGraphLaunch", kind: "cpu" });
    gpu.push({ start: 0, end: launchEnd, label: "idle", kind: "idle" });
    let t = launchEnd;
    for (let i = 0; i < NUM_KERNELS; i++) {
      gpu.push({ start: t, end: t + KERNEL_US, label: KERNEL_NAMES[i], kind: "gpu" });
      t += KERNEL_US;
    }
  }
  const total = Math.max(cpu[cpu.length - 1].end, gpu[gpu.length - 1].end);
  const events = Array.from(new Set([...cpu, ...gpu].flatMap((b) => [b.start, b.end]))).sort((a, b) => a - b);
  return { cpu, gpu, total, events };
}

function describe(mode: "stream" | "graph", t: number, cpu: Bar[], gpu: Bar[]): string {
  const c = cpu.find((b) => t >= b.start && t < b.end);
  const g = gpu.find((b) => t >= b.start && t < b.end);
  if (!c && !g) return mode === "stream"
    ? `All ${NUM_KERNELS} kernels done. The GPU spent most of that time waiting for the CPU.`
    : `All ${NUM_KERNELS} kernels done. One launch call, then the GPU ran them back to back.`;
  if (mode === "stream") {
    if (c && g?.kind === "idle") return `CPU is busy issuing "${c.label}" (driver call, ~${STREAM_LAUNCH_US} µs). GPU has nothing to do and sits idle.`;
    if (c && g?.kind === "gpu") return `GPU runs ${g.label} (~${KERNEL_US} µs) while the CPU is already issuing the next launch.`;
    if (!c && g?.kind === "gpu") return `CPU is finished. GPU runs the last kernel, ${g.label}.`;
  } else {
    if (c) return `CPU issues one cudaGraphLaunch for all ${NUM_KERNELS} kernels (~${GRAPH_PER_NODE_US} µs per node). GPU waits once.`;
    if (g?.kind === "gpu") return `GPU executes ${g.label}. The next node starts the moment this one finishes, no CPU round trip.`;
  }
  return "";
}

export default function LaunchTimelineSimulation() {
  const [mode, setMode] = useState<"stream" | "graph">("stream");
  const { cpu, gpu, total, events } = useMemo(() => buildTimeline(mode), [mode]);
  const SCALE = useMemo(() => buildTimeline("stream").total, []); // same x-axis for both modes

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) { if (raf.current) cancelAnimationFrame(raf.current); return; }
    last.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - last.current) / 1000; // seconds of wall time
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed * 4; // µs of simulated time per second
        if (next >= total) { setPlaying(false); return total; }
        return next;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, speed, total]);

  const stepIdx = Math.max(0, events.filter((e) => e <= t + 1e-6).length - 1);
  const gpuBusy = gpu.filter((b) => b.kind === "gpu").reduce((a, b) => a + Math.max(0, Math.min(t, b.end) - b.start), 0);
  const cpuBusy = cpu.reduce((a, b) => a + Math.max(0, Math.min(t, b.end) - b.start), 0);
  const pct = (x: number) => (t > 0 ? Math.round((x / t) * 100) : 0);

  const renderLane = (bars: Bar[], name: string) => (
    <div className="flex items-center gap-3">
      <div className="w-10 text-right text-[10px] font-mono font-semibold text-[#967f5e]">{name}</div>
      <div className="relative flex-1 h-9 border border-[#dccfb2] bg-[#f3eadb] overflow-hidden">
        {bars.map((b, i) => {
          const visibleEnd = Math.min(b.end, t);
          if (visibleEnd <= b.start) return null;
          const left = (b.start / SCALE) * 100;
          const width = ((visibleEnd - b.start) / SCALE) * 100;
          const cls =
            b.kind === "cpu" ? "bg-[#5e4a30] text-white" :
            b.kind === "gpu" ? "bg-[#2a1c0d] text-white" :
            "bg-[repeating-linear-gradient(45deg,#f0f0f0_0,#f0f0f0_4px,#fafafa_4px,#fafafa_8px)] text-[#b3a07a]";
          return (
            <div
              key={i}
              className={`absolute top-0 h-full flex items-center justify-center text-[9px] font-mono whitespace-nowrap overflow-hidden border-r border-white ${cls}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${b.label}: ${b.start.toFixed(1)}–${b.end.toFixed(1)} µs`}
            >
              {width > 5 ? b.label : ""}
            </div>
          );
        })}
        {/* playhead */}
        <div className="absolute top-0 h-full w-[2px] bg-[#2a1c0d]" style={{ left: `${(t / SCALE) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Mode switch */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["stream", "graph"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setT(0); setPlaying(false); }}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
              mode === m ? "border-[#2a1c0d] bg-[#2a1c0d] text-white" : "border-[#cfc09e] text-[#5e4a30] hover:border-[#967f5e]"
            }`}
          >
            {m === "stream" ? "A · plain stream launches" : "B · one graph launch"}
          </button>
        ))}
        <span className="text-[10px] font-mono text-[#967f5e] ml-auto">{NUM_KERNELS} tiny kernels · same x-axis for both</span>
      </div>

      <div className="border border-[#dccfb2] p-3">
        <div className="text-xs font-mono text-[#967f5e] mb-1">t = {t.toFixed(1)} µs</div>
        <div className="text-xs text-[#5e4a30] leading-relaxed min-h-[32px]">
          {t === 0 ? "Press RUN. Dark grey = CPU busy in the driver. Black = GPU running a kernel. Hatched = GPU idle." : describe(mode, t, cpu, gpu)}
        </div>
      </div>

      <div className="space-y-2">
        {renderLane(cpu, "CPU")}
        {renderLane(gpu, "GPU")}
        {/* axis */}
        <div className="flex items-center gap-3">
          <div className="w-10" />
          <div className="relative flex-1 h-4">
            {[0, 10, 20, 30, 40, 50, 60].map((v) => (
              <span key={v} className="absolute text-[9px] font-mono text-[#b3a07a] -translate-x-1/2" style={{ left: `${(v / SCALE) * 100}%` }}>{v}µs</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-[#dccfb2] p-3">
          <div className="text-[10px] font-mono text-[#967f5e] uppercase mb-1">Elapsed</div>
          <div className="text-sm font-mono text-[#2a1c0d]">{t.toFixed(1)} / {total.toFixed(1)} µs</div>
        </div>
        <div className="border border-[#dccfb2] p-3">
          <div className="text-[10px] font-mono text-[#967f5e] uppercase mb-1">GPU busy</div>
          <div className="text-sm font-mono text-[#2a1c0d]">{pct(gpuBusy)}%</div>
        </div>
        <div className="border border-[#dccfb2] p-3">
          <div className="text-[10px] font-mono text-[#967f5e] uppercase mb-1">CPU busy</div>
          <div className="text-sm font-mono text-[#2a1c0d]">{pct(cpuBusy)}%</div>
        </div>
      </div>

      <SimulationControls
        isPlaying={playing}
        onPlay={() => { if (t >= total) setT(0); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onStep={() => { setPlaying(false); const next = events.find((e) => e > t + 1e-6); setT(next ?? total); }}
        onBack={() => { setPlaying(false); const prev = [...events].reverse().find((e) => e < t - 1e-6); setT(prev ?? 0); }}
        onReset={() => { setPlaying(false); setT(0); }}
        currentStep={stepIdx}
        totalSteps={events.length}
        speed={speed}
        onSpeedChange={setSpeed}
        statusText={mode === "stream" ? "A: every kernel pays the launch tax" : "B: pay once, replay"}
      />
    </div>
  );
}
