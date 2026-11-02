"use client";

import { create } from "zustand";

interface AnimationStore {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  speed: number;
  approach: string;

  /** 0→1 progress within the current step (for interpolation) */
  stepProgress: number;
  /** 0→1 progress across the entire animation */
  continuousProgress: number;

  highlightedLines: number[];

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setSpeed: (speed: number) => void;
  setApproach: (approach: string) => void;
  setTotalSteps: (total: number) => void;
  setHighlightedLines: (lines: number[]) => void;

  /** Advance animation by `deltaMs` milliseconds. Returns true if a step boundary was crossed. */
  tick: (deltaMs: number, stepDuration: number) => boolean;

  /** Scrub to a specific continuous progress value (0→1) */
  scrubTo: (progress: number) => void;

  reset: () => void;
}

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  isPlaying: false,
  currentStep: 0,
  totalSteps: 0,
  speed: 1,
  approach: "naive",
  stepProgress: 0,
  continuousProgress: 0,
  highlightedLines: [],

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setStep: (step) => {
    const { totalSteps } = get();
    const clamped = Math.max(0, Math.min(step, totalSteps - 1));
    set({
      currentStep: clamped,
      stepProgress: 0,
      continuousProgress: totalSteps > 1 ? clamped / (totalSteps - 1) : 0,
    });
  },

  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      set({
        currentStep: next,
        stepProgress: 0,
        continuousProgress: totalSteps > 1 ? next / (totalSteps - 1) : 0,
      });
    } else {
      set({ isPlaying: false, stepProgress: 1 });
    }
  },

  prevStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep > 0) {
      const prev = currentStep - 1;
      set({
        currentStep: prev,
        stepProgress: 0,
        continuousProgress: totalSteps > 1 ? prev / (totalSteps - 1) : 0,
      });
    }
  },

  tick: (deltaMs, stepDuration) => {
    const { currentStep, totalSteps, stepProgress, speed, isPlaying } = get();
    if (!isPlaying || totalSteps === 0) return false;

    const effectiveDuration = stepDuration / speed;
    const progressIncrement = deltaMs / effectiveDuration;
    const newStepProgress = stepProgress + progressIncrement;

    if (newStepProgress >= 1) {
      // Step boundary crossed
      if (currentStep < totalSteps - 1) {
        const next = currentStep + 1;
        const overflow = newStepProgress - 1;
        set({
          currentStep: next,
          stepProgress: Math.min(overflow, 0.1), // carry over a tiny bit
          continuousProgress:
            totalSteps > 1 ? (next + Math.min(overflow, 0.1)) / (totalSteps - 1) : 0,
        });
      } else {
        set({
          stepProgress: 1,
          continuousProgress: 1,
          isPlaying: false,
        });
      }
      return true;
    }

    set({
      stepProgress: newStepProgress,
      continuousProgress:
        totalSteps > 1
          ? (currentStep + newStepProgress) / (totalSteps - 1)
          : 0,
    });
    return false;
  },

  scrubTo: (progress) => {
    const { totalSteps } = get();
    if (totalSteps <= 1) {
      set({ currentStep: 0, stepProgress: 0, continuousProgress: 0 });
      return;
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const floatStep = clampedProgress * (totalSteps - 1);
    const step = Math.min(Math.floor(floatStep), totalSteps - 1);
    const stepProg = step === totalSteps - 1 ? 1 : floatStep - step;

    set({
      currentStep: step,
      stepProgress: stepProg,
      continuousProgress: clampedProgress,
    });
  },

  setSpeed: (speed) => set({ speed }),
  setApproach: (approach) =>
    set({
      approach,
      currentStep: 0,
      stepProgress: 0,
      continuousProgress: 0,
      isPlaying: false,
    }),
  setTotalSteps: (total) => set({ totalSteps: total }),
  setHighlightedLines: (lines) => set({ highlightedLines: lines }),
  reset: () =>
    set({
      isPlaying: false,
      currentStep: 0,
      stepProgress: 0,
      continuousProgress: 0,
      highlightedLines: [],
    }),
}));
