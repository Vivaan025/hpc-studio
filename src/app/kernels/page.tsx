import Link from "next/link";
import { KERNELS } from "@/data/kernels";

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function KernelsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <section className="py-12 border-b border-[#dccfb2]">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a1c0d] mb-2">
          Kernels
        </h1>
        <p className="text-sm text-[#5e4a30]">
          Interactive step-by-step simulations of CUDA kernel execution.
        </p>
      </section>

      <div className="space-y-0 border-t border-[#dccfb2] mt-0">
        {KERNELS.map((kernel) => (
          <Link
            key={kernel.slug}
            href={`/kernels/${kernel.slug}`}
            className="flex items-start justify-between gap-4 py-6 border-b border-[#dccfb2] group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="font-heading text-base font-semibold text-[#2a1c0d] group-hover:underline">
                  {kernel.title}
                </h2>
                <span className="text-xs text-[#967f5e] font-mono px-2 py-0.5 border border-[#dccfb2]">
                  {difficultyLabel[kernel.difficulty]}
                </span>
              </div>
              <p className="text-sm text-[#5e4a30] leading-relaxed mb-2">
                {kernel.description}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {kernel.tags.map((tag) => (
                  <span key={tag} className="text-xs text-[#967f5e] font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 mt-1">
              <span className="text-xs text-[#bfad88] font-mono">
                {kernel.approaches.length} approaches →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
