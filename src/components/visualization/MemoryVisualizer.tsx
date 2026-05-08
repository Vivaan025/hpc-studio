"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimationDefinition, AnimationStep, MatrixDef } from "@/lib/types";
import { COLORS } from "@/lib/constants";

interface MemoryVisualizerProps {
  animation: AnimationDefinition;
  currentStep: AnimationStep;
}

export default function MemoryVisualizer({
  animation,
  currentStep,
}: MemoryVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const time = timeRef.current;
      ctx.clearRect(0, 0, width, height);

      const { memoryLayout } = animation;
      const matrices = memoryLayout.matrices;
      const matCount = matrices.length;

      // Layout matrices horizontally
      const padding = 16;
      const matGap = 20;
      const availW = width - padding * 2 - matGap * (matCount - 1);
      const matW = Math.min(availW / matCount, 160);

      const startX = (width - (matW * matCount + matGap * (matCount - 1))) / 2;

      matrices.forEach((mat: MatrixDef, mi: number) => {
        const mx = startX + mi * (matW + matGap);
        const myStart = 36;
        const cellW = (matW - 4) / mat.cols;
        const cellH = Math.min(cellW, (height - 60) / mat.rows);
        const matH = cellH * mat.rows;

        // Label
        ctx.fillStyle = mat.color;
        ctx.font = "bold 11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(mat.name, mx + matW / 2, myStart - 8);

        // Memory type badge
        ctx.fillStyle =
          mat.type === "shared"
            ? "rgba(245, 158, 11, 0.15)"
            : "rgba(99, 102, 241, 0.1)";
        const badgeText = mat.type === "shared" ? "SMEM" : "GMEM";
        const badgeW = ctx.measureText(badgeText).width + 12;
        const badgeX = mx + matW / 2 - badgeW / 2;

        ctx.beginPath();
        ctx.roundRect(badgeX, myStart - 4, badgeW, 16, 4);
        ctx.fill();

        ctx.fillStyle = mat.type === "shared" ? "#f59e0b" : COLORS.textSecondary;
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillText(badgeText, mx + matW / 2, myStart + 8);

        // Matrix background
        ctx.fillStyle = "rgba(18, 18, 26, 0.7)";
        ctx.strokeStyle = `${mat.color}33`;
        ctx.lineWidth = 1;
        roundedRect(ctx, mx, myStart + 16, matW, matH + 4, 6);
        ctx.fill();
        ctx.stroke();

        // Draw cells
        for (let r = 0; r < mat.rows; r++) {
          for (let c = 0; c < mat.cols; c++) {
            const cx = mx + 2 + c * cellW;
            const cy = myStart + 18 + r * cellH;

            // Check if this cell has an active memory operation
            let isActive = false;
            let opColor = "";
            let isRead = false;

            currentStep.memoryOps.forEach((op) => {
              op.cells.forEach((cell) => {
                if (
                  cell.matrixId === mat.id &&
                  cell.row === r &&
                  cell.col === c
                ) {
                  isActive = true;
                  opColor = op.color;
                  isRead = op.type === "read";
                }
              });
            });

            if (isActive) {
              const alpha = 0.5 + Math.sin(time * 5 + r * 0.5 + c * 0.3) * 0.3;
              ctx.fillStyle = `${opColor}${Math.round(alpha * 255)
                .toString(16)
                .padStart(2, "0")}`;
              ctx.beginPath();
              ctx.roundRect(cx + 1, cy + 1, cellW - 2, cellH - 2, 2);
              ctx.fill();

              // Glow
              ctx.shadowColor = opColor;
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.roundRect(cx + 1, cy + 1, cellW - 2, cellH - 2, 2);
              ctx.fill();
              ctx.shadowBlur = 0;

              // Arrow indicator
              if (isRead) {
                ctx.fillStyle = opColor;
                ctx.font = "8px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("↑", cx + cellW / 2, cy + cellH / 2 + 3);
              }
            } else {
              ctx.fillStyle = `${mat.color}15`;
              ctx.beginPath();
              ctx.roundRect(cx + 1, cy + 1, cellW - 2, cellH - 2, 2);
              ctx.fill();
            }

            // Cell border
            ctx.strokeStyle = `${mat.color}22`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.roundRect(cx + 1, cy + 1, cellW - 2, cellH - 2, 2);
            ctx.stroke();
          }
        }
      });

      // Draw data flow arrows between matrices
      if (currentStep.memoryOps.length > 0) {
        currentStep.memoryOps.forEach((op) => {
          const sourceMatIdx = matrices.findIndex((m: MatrixDef) =>
            op.cells.some((c) => c.matrixId === m.id)
          );
          if (sourceMatIdx >= 0 && sourceMatIdx < matCount - 1) {
            const fromX = startX + sourceMatIdx * (matW + matGap) + matW + 2;
            const toX = startX + (sourceMatIdx + 1) * (matW + matGap) - 2;
            const arrowY = height / 2;

            // Animated dashed line
            ctx.strokeStyle = op.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -time * 30;
            ctx.beginPath();
            ctx.moveTo(fromX, arrowY);
            ctx.lineTo(toX, arrowY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Arrow head
            ctx.fillStyle = op.color;
            ctx.beginPath();
            ctx.moveTo(toX, arrowY);
            ctx.lineTo(toX - 6, arrowY - 4);
            ctx.lineTo(toX - 6, arrowY + 4);
            ctx.closePath();
            ctx.fill();
          }
        });
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
