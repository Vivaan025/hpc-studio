"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getKernelBySlug } from "@/data/kernels";
import BlockReduceSimulation from "@/components/simulations/BlockReduceSimulation";
import MatmulSimulation from "@/components/simulations/MatmulSimulation";
import VecAddSimulation from "@/components/simulations/VecAddSimulation";
import ReductionSimulation from "@/components/simulations/ReductionSimulation";
import CoalescedSimulation from "@/components/simulations/CoalescedSimulation";
import TiledWalkthrough from "@/components/simulations/TiledWalkthrough";

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Map kernel slug + approach to simulation component
function getSimulation(slug: string, approachId: string) {
  if (slug === "matrix-multiplication") {
    if (approachId === "coalesced") return <CoalescedSimulation />;
    if (approachId === "tiled-walkthrough") return <TiledWalkthrough />;
    return <MatmulSimulation approach={approachId} />;
  }
  if (slug === "vector-addition") {
    return <VecAddSimulation approach={approachId} />;
  }
  if (slug === "parallel-reduction") {
    if (approachId === "warp-shuffle") {
      return <BlockReduceSimulation />;
    }
    return <ReductionSimulation approach={approachId} />;
  }
  return null;
}

export default function KernelPageClient({ slug }: { slug: string }) {
  const kernel = getKernelBySlug(slug);

  if (!kernel) {
    notFound();
  }

  const [approachId, setApproachId] = useState(kernel.approaches[0].id);
  const approach = kernel.approaches.find((a) => a.id === approachId) || kernel.approaches[0];

  const simulation = getSimulation(kernel.slug, approachId);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <section className="py-8 border-b border-[#dccfb2]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#967f5e] mb-4 font-mono">
          <Link href="/kernels" className="hover:text-[#5e4a30] transition-colors">
            Kernels
          </Link>
          <span>/</span>
          <span className="text-[#5e4a30]">{kernel.title}</span>
        </div>

        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a1c0d]">
            {kernel.title}
          </h1>
          <span className="text-xs text-[#967f5e] font-mono">
            {difficultyLabel[kernel.difficulty]}
          </span>
        </div>
        <p className="text-sm text-[#5e4a30] max-w-3xl leading-relaxed mb-3">
          {kernel.description}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {kernel.tags.map((tag) => (
            <span key={tag} className="text-xs text-[#967f5e] font-mono">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Approach Selector */}
      <section className="py-4 border-b border-[#dccfb2]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {kernel.approaches.map((a) => (
            <button
              key={a.id}
              onClick={() => setApproachId(a.id)}
              className={`px-4 py-2 text-sm font-mono transition-all duration-150 border-b-2 ${
                a.id === approach.id
                  ? "text-[#2a1c0d] font-semibold border-[#2a1c0d]"
                  : "text-[#967f5e] border-transparent hover:text-[#5e4a30] hover:border-[#cbbb98]"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </section>

      {/* Simulation */}
      <section className="py-6">
        {simulation ? (
          simulation
        ) : (
          <div className="space-y-4">
            {/* Code only view */}
            <div className="border border-[#dccfb2]">
              <div className="px-4 py-2 border-b border-[#dccfb2] flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#967f5e] uppercase tracking-wider">Source</span>
                <span className="text-[10px] font-mono text-[#bfad88]">{approach.id}.cu</span>
              </div>
              <pre className="p-4 text-sm font-mono text-[#2a1c0d] overflow-x-auto leading-relaxed">
                <code>{approach.code}</code>
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border border-[#dccfb2] p-3">
                <p className="text-[10px] text-[#967f5e] font-mono uppercase mb-1">Complexity</p>
                <p className="text-sm font-mono text-[#2a1c0d]">{approach.complexity}</p>
              </div>
              <div className="border border-[#dccfb2] p-3">
                <p className="text-[10px] text-[#967f5e] font-mono uppercase mb-1">Performance</p>
                <p className="text-sm font-mono text-[#2a1c0d]">{approach.performance}</p>
              </div>
              <div className="border border-[#dccfb2] p-3">
                <p className="text-[10px] text-[#967f5e] font-mono uppercase mb-1">Approach</p>
                <p className="text-sm font-mono text-[#2a1c0d]">{approach.name}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Approach details */}
      <section className="py-6 border-t border-[#dccfb2]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-[#967f5e] font-mono uppercase tracking-widest mb-1">Complexity</p>
            <p className="text-sm font-mono text-[#2a1c0d]">{approach.complexity}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#967f5e] font-mono uppercase tracking-widest mb-1">Performance</p>
            <p className="text-sm font-mono text-[#2a1c0d]">{approach.performance}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#967f5e] font-mono uppercase tracking-widest mb-1">Description</p>
            <p className="text-sm text-[#5e4a30] leading-relaxed">{approach.description}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 border-t border-[#dccfb2]">
        <div className="max-w-3xl">
          <h2 className="font-heading text-xl font-bold text-[#2a1c0d] mb-4">
            Understanding {kernel.title}
          </h2>

          {kernel.slug === "matrix-multiplication" && (
            <div className="space-y-4 text-sm text-[#5e4a30] leading-relaxed">
              <p>
                Matrix multiplication is the cornerstone of GPU computing and the foundation of deep learning.
                A simple C = A × B operation for N×N matrices requires N³ multiply-add operations — perfectly suited for massive parallelism.
              </p>
              <p>
                The naive approach has each thread independently read an entire row of A and column of B from global memory.
                This is extremely redundant — neighboring threads re-read the same data. The tiled approach fixes this by loading
                sub-matrices into fast shared memory, where they can be reused by all threads in the block.
              </p>
              <div className="border border-[#dccfb2] p-4">
                <h3 className="font-heading text-sm font-semibold text-[#2a1c0d] mb-2">Key Insight</h3>
                <p className="text-xs">
                  Shared memory (SRAM, ~48KB) is ~100× faster than global memory (HBM).
                  By loading tiles cooperatively, we reduce global memory reads from 2N per output element to 2N/TILE_SIZE.
                </p>
              </div>
            </div>
          )}

          {kernel.slug === "vector-addition" && (
            <div className="space-y-4 text-sm text-[#5e4a30] leading-relaxed">
              <p>
                Vector addition is the "Hello, World!" of CUDA programming. It introduces thread indexing and kernel launch configurations.
              </p>
              <div className="border border-[#dccfb2] p-4">
                <h3 className="font-heading text-sm font-semibold text-[#2a1c0d] mb-2">Key Insight</h3>
                <p className="text-xs">
                  The grid-stride loop pattern is preferred in production code because it decouples the number of
                  threads from the problem size, enabling better flexibility and occupancy.
                </p>
              </div>
            </div>
          )}

          {kernel.slug === "parallel-reduction" && (
            <div className="space-y-4 text-sm text-[#5e4a30] leading-relaxed">
              <p>
                Parallel reduction computes an aggregate (sum, min, max) over millions of elements using a tree-based
                approach. The key challenges are minimizing warp divergence and avoiding shared memory bank conflicts.
              </p>
              <div className="border border-[#dccfb2] p-4">
                <h3 className="font-heading text-sm font-semibold text-[#2a1c0d] mb-2">Key Insight</h3>
                <p className="text-xs">
                  Warp shuffle instructions (<code className="font-semibold">__shfl_down_sync</code>) allow threads within
                  a warp to directly exchange register values without shared memory — eliminating bank conflicts entirely
                  for the final 32-element reduction.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
