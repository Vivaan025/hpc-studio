import Link from "next/link";
import { KERNELS } from "@/data/kernels";
import GpuPlayground from "@/components/home/GpuPlayground";

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <section className="py-16 sm:py-20 border-b border-[#dccfb2] grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#2a1c0d] mb-4">
          HPC Studio
        </h1>
        <p className="text-[#5e4a30] text-lg sm:text-xl max-w-2xl leading-relaxed mb-6">
          Interactive visualizations that show you exactly what happens inside the GPU.
          Watch warp shuffles, shared memory loads, thread synchronization!!! Step by step, value by value.
        </p>
        <div className="flex items-center gap-3 text-sm text-[#967f5e] font-mono">
          <span>CUDA</span>
          <span>·</span>
          <span>Shared Memory</span>
          <span>·</span>
          <span>Warp Primitives</span>
          <span>·</span>
          <span>Parallel Reduction</span>
        </div>
        </div>
        <GpuPlayground />
      </section>

      {/* Kernels */}
      <section className="py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-heading text-xl font-bold text-[#2a1c0d]">
            Kernels
          </h2>
          <Link
            href="/kernels"
            className="text-sm text-[#967f5e] hover:text-[#5e4a30] transition-colors"
          >
            View all →
          </Link>
        </div>

        <div className="space-y-0 border-t border-[#dccfb2]">
          {KERNELS.map((kernel) => (
            <Link
              key={kernel.slug}
              href={`/kernels/${kernel.slug}`}
              className="flex items-start justify-between gap-4 py-5 border-b border-[#dccfb2] group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className="font-heading text-base font-semibold text-[#2a1c0d] group-hover:underline">
                    {kernel.title}
                  </h3>
                  <span className="text-xs text-[#967f5e] font-mono">
                    {difficultyLabel[kernel.difficulty]}
                  </span>
                </div>
                <p className="text-sm text-[#5e4a30] leading-relaxed line-clamp-2">
                  {kernel.description}
                </p>
                <div className="flex gap-2 mt-2">
                  {kernel.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-[#967f5e] font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 text-xs text-[#bfad88] font-mono mt-1">
                {kernel.approaches.length} approaches
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works 
      <section className="py-12 border-t border-[#dccfb2]">
        <h2 className="font-heading text-xl font-bold text-[#2a1c0d] mb-8">
          How it works
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              title: "1. Read the code",
              description:
                "See the actual CUDA kernel source with syntax highlighting. Active lines are marked as the simulation progresses.",
            },
            {
              title: "2. Step through execution",
              description:
                "Watch thread blocks, warps, and individual threads execute. See real values flow through registers, shared memory, and shuffle operations.",
            },
            {
              title: "3. Compare approaches",
              description:
                "Switch between naive and optimized implementations. Understand why tiling, coalescing, and warp primitives matter.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="font-heading text-sm font-semibold text-[#2a1c0d] mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-[#5e4a30] leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section> */
      }
    </div>
  );
}
