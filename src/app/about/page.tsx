"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative max-w-7xl mx-auto">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-primary font-mono text-sm mb-3">
            {"// about"}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-4"
          >
            About HPC Studio
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary max-w-2xl text-lg"
          >
            Making GPU computing accessible through interactive visualizations.
          </motion.p>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              Why HPC Studio?
            </h2>
            <p className="text-text-secondary leading-relaxed">
              GPU programming is notoriously difficult to learn. The concepts of thread blocks,
              memory hierarchies, warp divergence, and bank conflicts are abstract and hard to
              visualize from code alone. Traditional tutorials show you the code but never show you
              what&apos;s actually happening inside the GPU.
            </p>
            <p className="text-text-secondary leading-relaxed">
              <strong className="text-text-primary">HPC Studio changes that.</strong> Every CUDA kernel on this platform comes
              with animated, step-by-step visualizations that show you exactly which threads are active,
              which memory is being accessed, and how data flows through the GPU hierarchy.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {[
              { number: "3+", label: "Kernel Topics", desc: "Matrix Multiply, Reduction, Vector Add" },
              { number: "8+", label: "Approaches", desc: "Naive to optimized implementations" },
              { number: "60fps", label: "Visualizations", desc: "Smooth Canvas 2D animations" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-6 text-center">
                <p className="text-3xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {stat.number}
                </p>
                <p className="font-heading font-semibold text-text-primary mt-2">{stat.label}</p>
                <p className="text-xs text-text-muted mt-1">{stat.desc}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              Tech Stack
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { name: "Next.js 14", desc: "App Router + SSR" },
                { name: "Tailwind CSS", desc: "Utility-first styling" },
                { name: "Canvas 2D", desc: "GPU visualizations" },
                { name: "Framer Motion", desc: "UI animations" },
                { name: "TypeScript", desc: "Type safety" },
                { name: "Zustand", desc: "State management" },
                { name: "Node.js", desc: "Backend API" },
                { name: "MDX", desc: "Blog content" },
              ].map((tech) => (
                <div key={tech.name} className="glass rounded-xl p-4">
                  <p className="font-mono text-sm font-bold text-text-primary">{tech.name}</p>
                  <p className="text-xs text-text-muted mt-1">{tech.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h2 className="font-heading text-2xl font-bold text-text-primary mb-4">
              Start Learning
            </h2>
            <p className="text-text-secondary mb-6">
              Dive into your first kernel visualization and see GPU programming like never before.
            </p>
            <Link href="/kernels/matrix-multiplication">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-white font-medium shadow-lg glow-primary"
              >
                Explore Matrix Multiplication →
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
