"use client";

import { useAnimationStore } from "@/store/animationStore";
import { AnimationStep } from "@/lib/types";
import { motion } from "framer-motion";
import { COLORS } from "@/lib/constants";

interface AnimationControlsProps {
  steps: AnimationStep[];
}

export default function AnimationControls({ steps }: AnimationControlsProps) {
  const {
    isPlaying,
    currentStep,
    speed,
    toggle,
    nextStep,
    prevStep,
    setStep,
    setSpeed,
  } = useAnimationStore();

  const totalSteps = steps.length;
  const step = steps[currentStep];

  const speeds = [0.5, 1, 1.5, 2, 4];

  return (
    <div className="space-y-3">
      {/* Step description */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-md bg-primary/20 text-primary font-mono text-xs font-bold">
            {currentStep + 1}/{totalSteps}
          </span>
          <h3 className="font-heading text-sm font-semibold text-text-primary">
            {step?.label || "Ready"}
          </h3>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          {step?.description || "Press play to start the animation."}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Playback buttons */}
        <div className="flex items-center gap-1">
          {/* Skip to start */}
          <button
            onClick={() => setStep(0)}
            disabled={currentStep === 0}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Skip to start"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Previous */}
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous step"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggle}
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-primary hover:bg-primary-glow text-white shadow-lg glow-primary transition-all duration-200"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </motion.button>

          {/* Next */}
          <button
            onClick={nextStep}
            disabled={currentStep >= totalSteps - 1}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Next step"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ transform: "scaleX(-1)" }}
            >
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Skip to end */}
          <button
            onClick={() => setStep(totalSteps - 1)}
            disabled={currentStep >= totalSteps - 1}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Skip to end"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ transform: "scaleX(-1)" }}
            >
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 mx-2">
          <div className="relative h-2 bg-surface-elevated rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={false}
              animate={{
                width: `${totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0}%`,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            {/* Step markers */}
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all duration-200 hover:scale-125"
                style={{
                  left: `${totalSteps > 1 ? (i / (totalSteps - 1)) * 100 : 0}%`,
                  borderColor:
                    i <= currentStep ? COLORS.primary : COLORS.borderSubtle,
                  backgroundColor:
                    i === currentStep
                      ? COLORS.primary
                      : i < currentStep
                      ? COLORS.primaryGlow
                      : COLORS.surface,
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted font-mono">Speed:</span>
          <div className="flex items-center bg-surface-elevated rounded-lg p-0.5">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-md text-xs font-mono transition-all duration-200 ${
                  speed === s
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
