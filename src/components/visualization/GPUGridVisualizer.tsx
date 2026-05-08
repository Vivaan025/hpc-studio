"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimationDefinition, AnimationStep } from "@/lib/types";
import { COLORS } from "@/lib/constants";

interface GPUGridVisualizerProps {
  animation: AnimationDefinition;
  currentStep: AnimationStep;
  progress: number;
}

export default function GPUGridVisualizer({
  animation,
  currentStep,
  progress,
}: GPUGridVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const time = timeRef.current;
      ctx.clearRect(0, 0, width, height);

      const { gridDim, blockDim } = animation;
      const padding = 20;
      const gap = 8;

      // Calculate block size
      const totalBlocksX = gridDim.x;
      const totalBlocksY = gridDim.y;
      const availW = width - padding * 2 - gap * (totalBlocksX - 1);
      const availH = height - padding * 2 - gap * (totalBlocksY - 1) - 40;
      const blockW = availW / totalBlocksX;
      const blockH = availH / totalBlocksY;

      // Title
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `Grid: ${gridDim.x}×${gridDim.y} blocks  |  Block: ${blockDim.x}×${blockDim.y} threads`,
        width / 2,
        18
      );

      // Draw each block
      for (let by = 0; by < totalBlocksY; by++) {
        for (let bx = 0; bx < totalBlocksX; bx++) {
          const x = padding + bx * (blockW + gap);
          const y = 30 + by * (blockH + gap);

          const isActive = currentStep.activeBlocks.some(
            (b) => b.x === bx && b.y === by
          );

          // Block background
          ctx.fillStyle = isActive
            ? "rgba(99, 102, 241, 0.08)"
            : "rgba(18, 18, 26, 0.6)";
          ctx.strokeStyle = isActive
            ? COLORS.primary
            : COLORS.borderSubtle;
          ctx.lineWidth = isActive ? 2 : 1;

          roundedRect(ctx, x, y, blockW, blockH, 8);
          ctx.fill();
          ctx.stroke();

          // Glow effect for active blocks
          if (isActive) {
            ctx.shadowColor = COLORS.primary;
            ctx.shadowBlur = 12 + Math.sin(time * 3) * 4;
            ctx.strokeStyle = COLORS.primary;
            roundedRect(ctx, x, y, blockW, blockH, 8);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // Block label
          ctx.fillStyle = isActive ? COLORS.textPrimary : COLORS.textSecondary;
          ctx.font = "10px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(`Block(${bx},${by})`, x + blockW / 2, y + 14);

          // Draw threads inside block
          const threadGap = 2;
          const threadAreaX = x + 6;
          const threadAreaY = y + 22;
          const threadAreaW = blockW - 12;
          const threadAreaH = blockH - 28;
          const threadW = (threadAreaW - threadGap * (blockDim.x - 1)) / blockDim.x;
          const threadH = (threadAreaH - threadGap * (blockDim.y - 1)) / blockDim.y;

          for (let ty = 0; ty < blockDim.y; ty++) {
            for (let tx = 0; tx < blockDim.x; tx++) {
              const tx_ = threadAreaX + tx * (threadW + threadGap);
              const ty_ = threadAreaY + ty * (threadH + threadGap);
              const threadIdx = ty * blockDim.x + tx;

              const isThreadActive =
                isActive &&
                currentStep.activeThreads.some(
                  (t) =>
                    t.blockIdx.x === bx &&
                    t.blockIdx.y === by &&
                    threadIdx >= t.threadStart &&
                    threadIdx <= t.threadEnd
                );

              // Thread cell
              if (isThreadActive) {
                const pulseAlpha = 0.6 + Math.sin(time * 4 + threadIdx * 0.3) * 0.3;
                ctx.fillStyle = `rgba(74, 222, 128, ${pulseAlpha})`;
              } else {
                ctx.fillStyle = isActive
                  ? "rgba(99, 102, 241, 0.15)"
                  : "rgba(42, 42, 62, 0.3)";
              }

              ctx.beginPath();
              ctx.roundRect(tx_, ty_, threadW, threadH, 2);
              ctx.fill();

              if (isThreadActive) {
                ctx.shadowColor = COLORS.accentGreen;
                ctx.shadowBlur = 6;
                ctx.fillStyle = `rgba(74, 222, 128, 0.5)`;
                ctx.beginPath();
                ctx.roundRect(tx_, ty_, threadW, threadH, 2);
                ctx.fill();
                ctx.shadowBlur = 0;
              }
            }
          }
        }
      }
    },
    [animation, currentStep]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    resizeObserver.observe(canvas.parentElement!);

    let running = true;
    const animate = (timestamp: number) => {
      if (!running) return;
      timeRef.current = timestamp / 1000;
      const rect = canvas.getBoundingClientRect();
      draw(ctx, rect.width, rect.height);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [draw]);

  return (
    <div className="w-full h-full min-h-[200px]">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
