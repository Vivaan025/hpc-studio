import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <section className="py-12 border-b border-[#dccfb2]">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a1c0d] mb-2">
          About HPC Studio
        </h1>
        <p className="text-sm text-[#5e4a30]">
          Making GPU computing accessible through interactive visualizations.
        </p>
      </section>

      <section className="py-8 space-y-8">
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#2a1c0d]">
            Why HPC Studio?
          </h2>
          <p className="text-sm text-[#5e4a30] leading-relaxed">
            GPU programming is notoriously difficult to learn. The concepts of thread blocks,
            memory hierarchies, warp divergence, and bank conflicts are abstract and hard to
            visualize from code alone. Traditional tutorials show you the code but never show you
            what&apos;s actually happening inside the GPU.
          </p>
          <p className="text-sm text-[#5e4a30] leading-relaxed">
            <strong className="text-[#2a1c0d]">HPC Studio changes that.</strong> Every CUDA kernel on this platform comes
            with interactive, step-by-step simulations that show you exactly which threads are active,
            which memory is being accessed, and how data flows through the GPU hierarchy.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { number: "3+", label: "Kernel Topics" },
            { number: "8+", label: "Approaches" },
            { number: "Live", label: "Simulations" },
          ].map((stat) => (
            <div key={stat.label} className="border border-[#dccfb2] p-4 text-center">
              <p className="text-2xl font-heading font-bold text-[#2a1c0d]">
                {stat.number}
              </p>
              <p className="text-xs text-[#967f5e] font-mono mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="border border-[#dccfb2] p-6 text-center">
          <h2 className="font-heading text-lg font-bold text-[#2a1c0d] mb-2">
            Start Learning
          </h2>
          <p className="text-sm text-[#5e4a30] mb-4">
            Dive into your first kernel visualization.
          </p>
          <Link
            href="/kernels/matrix-multiplication"
            className="inline-block px-6 py-2 text-sm font-mono bg-[#2a1c0d] text-white hover:bg-[#41301c] transition-colors"
          >
            Explore Matrix Multiplication →
          </Link>
        </div>
      </section>
    </div>
  );
}
