"use client";

import { motion } from "framer-motion";
import { KERNELS } from "@/data/kernels";
import KernelCard from "@/components/kernel/KernelCard";
import { useState } from "react";

export default function KernelsPage() {
  const [filter, setFilter] = useState<string>("all");
  const allTags = Array.from(new Set(KERNELS.flatMap((k) => k.tags)));
  const filtered = filter === "all" ? KERNELS : KERNELS.filter((k) => k.tags.includes(filter));

  return (
    <div className="min-h-screen">
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative max-w-7xl mx-auto">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-primary font-mono text-sm mb-3">
            {"// all_kernels"}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Kernel Catalog
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-text-secondary max-w-2xl text-lg">
            Browse all CUDA kernels with interactive visualizations. Each kernel includes multiple optimization approaches.
          </motion.p>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setFilter("all")} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === "all" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary border border-border-subtle"}`}>
              All
            </button>
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setFilter(tag)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === tag ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text-primary border border-border-subtle"}`}>
                {tag}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((kernel, i) => (
              <KernelCard key={kernel.slug} kernel={kernel} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
