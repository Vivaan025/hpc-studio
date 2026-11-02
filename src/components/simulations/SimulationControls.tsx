"use client";

interface SimulationControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onBack: () => void;
  onReset: () => void;
  currentStep: number;
  totalSteps: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  statusText?: string;
  children?: React.ReactNode;
}

export default function SimulationControls({
  isPlaying,
  onPlay,
  onPause,
  onStep,
  onBack,
  onReset,
  currentStep,
  totalSteps,
  speed,
  onSpeedChange,
  statusText,
  children,
}: SimulationControlsProps) {
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Status */}
      {statusText && (
        <div className="text-sm text-[#5e4a30] font-mono text-center min-h-[20px]">
          {statusText}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-[3px] bg-[#dccfb2] relative">
        <div
          className="h-full bg-[#2a1c0d] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="px-4 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider border border-[#2a1c0d] bg-[#2a1c0d] text-white hover:bg-[#41301c] transition-colors"
          >
            {isPlaying ? "Pause" : "Run"}
          </button>
          <button
            onClick={onBack}
            disabled={currentStep <= 0}
            className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-[#cfc09e] text-[#5e4a30] hover:border-[#967f5e] hover:text-[#2a1c0d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ‹ Prev
          </button>
          <button
            onClick={onStep}
            disabled={currentStep >= totalSteps - 1}
            className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-[#cfc09e] text-[#5e4a30] hover:border-[#967f5e] hover:text-[#2a1c0d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next ›
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-[#cfc09e] text-[#5e4a30] hover:border-[#967f5e] hover:text-[#2a1c0d] transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Step counter */}
          <span className="text-xs text-[#967f5e] font-mono">
            step {currentStep + 1}/{totalSteps}
          </span>

          {/* Config dropdowns from parent */}
          {children}

          {/* Speed */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#967f5e] font-mono uppercase">Speed</span>
            <input
              type="range"
              min="1"
              max="10"
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="w-20 h-[2px] bg-[#cfc09e] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#2a1c0d] [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
