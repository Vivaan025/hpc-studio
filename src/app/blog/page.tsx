"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BlogPost } from "@/lib/types";

const BLOG_POSTS: BlogPost[] = [
  {
    slug: "understanding-gpu-architecture",
    title: "Understanding GPU Architecture from Scratch",
    date: "2026-05-08",
    author: "HPC Studio",
    tags: ["GPU", "Architecture", "CUDA"],
    excerpt: "A deep dive into how modern GPUs are structured — from SMs and warps to the memory hierarchy. Essential reading before writing your first CUDA kernel.",
    readTime: "12 min",
    difficulty: "beginner",
  },
  {
    slug: "memory-coalescing-deep-dive",
    title: "Memory Coalescing: The #1 GPU Performance Trick",
    date: "2026-05-06",
    author: "HPC Studio",
    tags: ["Memory", "Optimization", "Performance"],
    excerpt: "Why accessing global memory in the wrong pattern can slow your kernel by 10× and how coalesced access patterns maximize bandwidth utilization.",
    readTime: "8 min",
    difficulty: "intermediate",
  },
  {
    slug: "shared-memory-bank-conflicts",
    title: "Shared Memory Bank Conflicts Explained",
    date: "2026-05-04",
    author: "HPC Studio",
    tags: ["Shared Memory", "Bank Conflicts", "Optimization"],
    excerpt: "Understanding how shared memory is organized into banks, what happens when multiple threads access the same bank, and how padding eliminates conflicts.",
    readTime: "10 min",
    difficulty: "advanced",
  },
];

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "bg-accent-green/10", text: "text-accent-green" },
  intermediate: { bg: "bg-accent-orange/10", text: "text-accent-orange" },
  advanced: { bg: "bg-accent-red/10", text: "text-accent-red" },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="relative max-w-7xl mx-auto">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-primary font-mono text-sm mb-3">
            {"// blog"}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Blog
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-text-secondary max-w-2xl text-lg">
            Deep dives into GPU computing concepts, optimization techniques, and CUDA programming patterns.
          </motion.p>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {BLOG_POSTS.map((post, i) => {
            const d = DIFF_COLORS[post.difficulty];
            return (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="glass rounded-2xl p-6 sm:p-8 group hover:bg-surface-elevated/50 transition-all duration-300 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${d.bg} ${d.text}`}>
                        {post.difficulty}
                      </span>
                      <span className="text-xs text-text-muted">{post.date}</span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">{post.readTime}</span>
                    </div>
                    <h2 className="font-heading text-xl sm:text-2xl font-bold text-text-primary mb-3 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-text-secondary text-sm leading-relaxed mb-4">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-border-subtle/30 text-text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
