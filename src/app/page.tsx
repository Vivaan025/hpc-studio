"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { KERNELS } from "@/data/kernels";
import KernelCard from "@/components/kernel/KernelCard";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" },
  }),
};

export default function Home() {
  return (
    <div className="relative">
      {/* ── Hero Section ── */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Animated dot grid background */}
        <div className="absolute inset-0 dot-grid-animated" />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: "-3s" }} />

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              Open Source CUDA Learning Platform
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-text-primary">See CUDA Kernels</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
              Come Alive
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Interactive visualizations that show you{" "}
            <span className="text-text-primary font-medium">exactly what happens inside the GPU</span>.
            Watch thread blocks execute, memory access patterns form, and warps
            synchronize — step by step.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link href="/kernels">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-white font-medium shadow-lg glow-primary hover:shadow-xl transition-all duration-300"
              >
                Explore Kernels
              </motion.button>
            </Link>
            <Link href="/blog">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3.5 rounded-xl glass text-text-primary font-medium hover:bg-surface-elevated transition-all duration-300"
              >
                Read Blog
              </motion.button>
            </Link>
          </motion.div>

          {/* Tech stack pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mt-16 flex items-center justify-center gap-3 flex-wrap"
          >
            {["CUDA", "C++", "GPU Computing", "Shared Memory", "Warp Primitives"].map(
              (tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-lg text-xs font-mono text-text-muted bg-surface border border-border-subtle"
                >
                  {tech}
                </span>
              )
            )}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-border-subtle flex items-start justify-center p-1.5"
          >
            <div className="w-1.5 h-2.5 rounded-full bg-text-muted" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Featured Kernels Section ── */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-primary font-mono text-sm mb-3"
            >
              // kernel_catalog
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            >
              Featured Kernels
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-text-secondary max-w-xl mx-auto"
            >
              Each kernel comes with multiple optimization approaches, animated
              step-by-step and side-by-side comparisons.
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {KERNELS.map((kernel, i) => (
              <KernelCard key={kernel.slug} kernel={kernel} index={i} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <Link
              href="/kernels"
              className="inline-flex items-center gap-2 text-primary hover:text-primary-glow text-sm font-medium transition-colors"
            >
              View all kernels
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-secondary font-mono text-sm mb-3"
            >
              // how_it_works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            >
              Learn GPU Programming Visually
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                    <path d="M7 8l3 3-3 3M12 14h5" />
                  </svg>
                ),
                title: "Read the Code",
                description:
                  "See the actual CUDA kernel code with syntax highlighting. Each line lights up as the animation progresses.",
                color: "primary",
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-secondary">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                ),
                title: "Watch It Execute",
                description:
                  "Animated canvas visualizations show thread blocks, memory accesses, and data flow in real-time.",
                color: "secondary",
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-green">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: "Compare Approaches",
                description:
                  "Switch between naive, optimized, and expert implementations. See how performance scales with each optimization.",
                color: "accent-green",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="glass rounded-2xl p-8 text-center group hover:bg-surface-elevated/50 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-surface-elevated mb-5 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="font-heading text-lg font-bold text-text-primary mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-6">
              Ready to dive into{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                GPU programming
              </span>
              ?
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              Start with our most popular kernel — Matrix Multiplication — and see how
              shared memory tiling can boost performance by 15×.
            </p>
            <Link href="/kernels/matrix-multiplication">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-white font-medium text-lg shadow-lg glow-primary hover:shadow-xl transition-all duration-300"
              >
                Start with Matrix Multiplication →
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
