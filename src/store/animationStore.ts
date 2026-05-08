"use client";

import { create } from "zustand";

interface AnimationStore {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  speed: number;
  approach: string;
  progress: number;
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
  setProgress: (progress: number) => void;
  setHighlightedLines: (lines: number[]) => void;
  reset: () => void;
}

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  isPlaying: false,
  currentStep: 0,
  totalSteps: 0,
  speed: 1,
  approach: "naive",
  progress: 0,
  highlightedLines: [],

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setStep: (step) => {
    const { totalSteps } = get();
    const clamped = Math.max(0, Math.min(step, totalSteps - 1));
    set({
      currentStep: clamped,
      progress: totalSteps > 0 ? clamped / (totalSteps - 1) : 0,
    });
  },

  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      set({
        currentStep: next,
        progress: totalSteps > 0 ? next / (totalSteps - 1) : 0,
      });
    } else {
      set({ isPlaying: false });
    }
  },

  prevStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep > 0) {
      const prev = currentStep - 1;
      set({
        currentStep: prev,
        progress: totalSteps > 0 ? prev / (totalSteps - 1) : 0,
      });
    }
  },

  setSpeed: (speed) => set({ speed }),
  setApproach: (approach) => set({ approach, currentStep: 0, progress: 0, isPlaying: false }),
  setTotalSteps: (total) => set({ totalSteps: total }),
  setProgress: (progress) => set({ progress }),
  setHighlightedLines: (lines) => set({ highlightedLines: lines }),
  reset: () =>
    set({
      isPlaying: false,
      currentStep: 0,
      progress: 0,
      highlightedLines: [],
    }),
}));
