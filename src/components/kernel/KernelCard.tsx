"use client";

import Link from "next/link";
import { Kernel } from "@/lib/types";

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

interface KernelCardProps {
  kernel: Kernel;
  index: number;
}

export default function KernelCard({ kernel }: KernelCardProps) {
  return (
    <Link
      href={`/kernels/${kernel.slug}`}
      className="block border border-[#dccfb2] p-5 hover:border-[#967f5e] transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <h3 className="font-heading text-sm font-semibold text-[#2a1c0d]">
          {kernel.title}
        </h3>
        <span className="text-[10px] text-[#967f5e] font-mono uppercase">
          {difficultyLabel[kernel.difficulty]}
        </span>
      </div>
      <p className="text-xs text-[#5e4a30] leading-relaxed line-clamp-2 mb-3">
        {kernel.description}
      </p>
      <div className="flex gap-2">
        {kernel.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] text-[#967f5e] font-mono">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
