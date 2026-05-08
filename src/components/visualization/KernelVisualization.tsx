"use client";

import { useEffect, useCallback, useRef } from "react";
import { AnimationDefinition } from "@/lib/types";
import { useAnimationStore } from "@/store/animationStore";
import GPUGridVisualizer from "./GPUGridVisualizer";
import MemoryVisualizer from "./MemoryVisualizer";
import AnimationControls from "./AnimationControls";
import CodeBlock from "@/components/blog/CodeBlock";
import { Approach } from "@/lib/types";
import { motion } from "framer-motion";

interface KernelVisualizationProps {
  animation: AnimationDefinition;
  approach: Approach;
  approaches: Approach[];
  onApproachChange: (id: string) => void;
}

export default function KernelVisualization({
  animation,
  approach,
  approaches,
  onApproachChange,
}: KernelVisualizationProps) {
  const {
    isPlaying,
    currentStep,
    speed,
    nextStep,
    setTotalSteps,
    setHighlightedLines,
    reset,
  } = useAnimationStore();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set total steps when animation changes
  useEffect(() => {
    reset();
    setTotalSteps(animation.steps.length);
  }, [animation, reset, setTotalSteps]);

  // Update highlighted lines when step changes
  useEffect(() => {
    const step = animation.steps[currentStep];
    if (step) {
      setHighlightedLines(step.highlightedCodeLines);
    }
  }, [currentStep, animation, setHighlightedLines]);

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      const step = animation.steps[currentStep];
      const duration = step ? step.duration / speed : 2000;

      timerRef.current = setTimeout(() => {
        nextStep();
      }, duration);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [isPlaying, currentStep, speed, animation, nextStep]);

  const step = animation.steps[currentStep] || animation.steps[0];

  return (
    <div className="space-y-4">
      {/* Approach Selector */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {approaches.map((a) => (
          <button
            key={a.id}
            onClick={() => onApproachChange(a.id)}
            className={`relative flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              a.id === approach.id
                ? "text-white"
                : "text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-elevated border border-border-subtle"
            }`}
          >
            {a.id === approach.id && (
              <motion.div
                layoutId="approach-selector"
                className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow rounded-xl"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{a.name}</span>
          </button>
        ))}
      </div>

      {/* Main split-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code Panel */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-accent-red/60" />
                <div className="w-3 h-3 rounded-full bg-accent-orange/60" />
                <div className="w-3 h-3 rounded-full bg-accent-green/60" />
              </div>
              <span className="text-xs font-mono text-text-muted ml-2">
                {approach.id}.cu
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
              CUDA
            </span>
          </div>
          <div className="max-h-[500px] overflow-y-auto no-scrollbar">
            <CodeBlock
              code={approach.code}
              language="cuda"
              highlightedLines={step?.highlightedCodeLines || []}
              showLineNumbers={true}
            />
          </div>
        </div>

        {/* Visualization Panel */}
        <div className="glass rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-heading font-semibold text-text-primary">
              GPU Execution View
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="text-xs text-text-muted">Live</span>
            </div>
          </div>

          {/* GPU Grid */}
          <div className="flex-1 min-h-[220px] p-2">
            <GPUGridVisualizer
              animation={animation}
              currentStep={step}
              progress={currentStep / Math.max(animation.steps.length - 1, 1)}
            />
          </div>

          {/* Memory View */}
          <div className="border-t border-border-subtle">
            <div className="px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-heading font-semibold text-text-primary">
                Memory Hierarchy
              </span>
              <div className="flex items-center gap-3 ml-auto">
                {animation.memoryLayout.matrices
                  .filter((m) => m.type === "global")
                  .map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-1 text-xs text-text-muted"
                    >
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.name}
                    </span>
                  ))}
              </div>
            </div>
            <div className="h-[180px] p-2">
              <MemoryVisualizer animation={animation} currentStep={step} />
            </div>
          </div>
        </div>
      </div>

      {/* Animation Controls */}
      <AnimationControls steps={animation.steps} />

      {/* Approach Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Complexity</p>
          <p className="text-sm font-mono text-accent-orange">{approach.complexity}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Performance</p>
          <p className="text-sm font-mono text-accent-green">{approach.performance}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Approach</p>
          <p className="text-sm font-mono text-primary">{approach.name}</p>
        </div>
      </div>
    </div>
  );
}
