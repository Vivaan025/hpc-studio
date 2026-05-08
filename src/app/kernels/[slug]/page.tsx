"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { getKernelBySlug } from "@/data/kernels";
import { getAnimation } from "@/data/animations";
import KernelVisualization from "@/components/visualization/KernelVisualization";
import { DIFFICULTY_COLORS } from "@/lib/constants";

export default function KernelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const kernel = getKernelBySlug(slug);

  if (!kernel) {
    notFound();
  }

  const [approachId, setApproachId] = useState(kernel.approaches[0].id);
  const approach = kernel.approaches.find((a) => a.id === approachId) || kernel.approaches[0];
  const animation = getAnimation(kernel.slug, approachId);
  const diff = DIFFICULTY_COLORS[kernel.difficulty];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <Link href="/kernels" className="hover:text-primary transition-colors">
              Kernels
            </Link>
            <span>/</span>
            <span className="text-text-secondary">{kernel.title}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${diff.bg} ${diff.text}`}>
                  {diff.label}
                </span>
                <span className="text-xs text-text-muted">
                  {kernel.approaches.length} approaches
                </span>
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-3"
              >
                {kernel.title}
              </motion.h1>
              <p className="text-text-secondary max-w-3xl leading-relaxed">
                {kernel.description}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {kernel.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-lg text-xs font-mono bg-surface border border-border-subtle text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Visualization */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {animation ? (
            <KernelVisualization
              animation={animation}
              approach={approach}
              approaches={kernel.approaches}
              onApproachChange={setApproachId}
            />
          ) : (
            <div>
              {/* Approach selector even without animation */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                {kernel.approaches.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setApproachId(a.id)}
                    className={`relative flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      a.id === approach.id
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-elevated border border-border-subtle"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>

              {/* Code only view */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-accent-red/60" />
                    <div className="w-3 h-3 rounded-full bg-accent-orange/60" />
                    <div className="w-3 h-3 rounded-full bg-accent-green/60" />
                  </div>
                  <span className="text-xs font-mono text-text-muted ml-2">{approach.id}.cu</span>
                </div>
                <pre className="p-6 text-sm font-mono text-text-primary overflow-x-auto">
                  <code>{approach.code}</code>
                </pre>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-1">Complexity</p>
                  <p className="text-sm font-mono text-accent-orange">{approach.complexity}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-1">Performance</p>
                  <p className="text-sm font-mono text-accent-green">{approach.performance}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-1">Description</p>
                  <p className="text-sm text-text-secondary">{approach.description}</p>
                </div>
              </div>

              <div className="glass rounded-xl p-6 mt-4">
                <p className="text-sm text-text-muted text-center">
                  🎬 Animation visualization coming soon for this approach.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Content / Blog section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto prose prose-invert">
          <h2 className="font-heading text-2xl font-bold text-text-primary mb-6">
            Understanding {kernel.title}
          </h2>

          {kernel.slug === "matrix-multiplication" && (
            <div className="space-y-6 text-text-secondary leading-relaxed">
              <p>
                Matrix multiplication is the cornerstone of GPU computing and the foundation of deep learning.
                A simple C = A × B operation for N×N matrices requires N³ multiply-add operations — perfectly suited for massive parallelism.
              </p>

              <div className="glass rounded-xl p-6">
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">Why GPU?</h3>
                <p className="text-sm">
                  A modern GPU has thousands of cores that can execute the same instruction on different data simultaneously (SIMT).
                  For matrix multiplication, each element of the output matrix C can be computed independently — making it an embarrassingly parallel problem.
                </p>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">Key Concepts</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li><strong className="text-primary">Thread Mapping:</strong> Each thread computes one element of the output matrix C[row][col]</li>
                  <li><strong className="text-secondary">Shared Memory:</strong> On-chip memory (~48KB) shared by all threads in a block — 100× faster than global memory</li>
                  <li><strong className="text-accent-green">Memory Coalescing:</strong> Consecutive threads accessing consecutive memory addresses for maximum bandwidth</li>
                  <li><strong className="text-accent-orange">Tiling:</strong> Breaking the computation into sub-matrix blocks that fit in shared memory</li>
                </ul>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">Performance Impact</h3>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-accent-red">~2%</p>
                    <p className="text-xs text-text-muted mt-1">Naive</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-accent-orange">~30%</p>
                    <p className="text-xs text-text-muted mt-1">Tiled</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-accent-green">~50%</p>
                    <p className="text-xs text-text-muted mt-1">Coalesced</p>
                  </div>
                </div>
                <p className="text-xs text-text-muted text-center mt-3">% of theoretical peak FLOPS</p>
              </div>
            </div>
          )}

          {kernel.slug === "vector-addition" && (
            <div className="space-y-6 text-text-secondary leading-relaxed">
              <p>
                Vector addition is the &ldquo;Hello, World!&rdquo; of CUDA programming. It introduces the fundamental concepts
                of thread indexing and kernel launch configurations.
              </p>
              <div className="glass rounded-xl p-6">
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">Key Takeaway</h3>
                <p className="text-sm">
                  The grid-stride loop pattern is preferred in production code because it decouples the number of
                  threads from the problem size, enabling better flexibility and occupancy.
                </p>
              </div>
            </div>
          )}

          {kernel.slug === "parallel-reduction" && (
            <div className="space-y-6 text-text-secondary leading-relaxed">
              <p>
                Parallel reduction computes an aggregate (sum, min, max) over millions of elements using a tree-based
                approach. The key challenge is minimizing warp divergence and avoiding bank conflicts in shared memory.
              </p>
              <div className="glass rounded-xl p-6">
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">Key Optimization</h3>
                <p className="text-sm">
                  Warp shuffle instructions (<code className="text-primary">__shfl_down_sync</code>) allow threads within
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
