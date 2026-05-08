"use client";

import { use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const POSTS: Record<string, { title: string; date: string; readTime: string; content: string }> = {
  "understanding-gpu-architecture": {
    title: "Understanding GPU Architecture from Scratch",
    date: "May 8, 2026",
    readTime: "12 min",
    content: `
Modern GPUs are massively parallel processors designed to handle thousands of concurrent threads. Understanding the hardware architecture is essential for writing efficient CUDA kernels.

## The GPU Hierarchy

### Streaming Multiprocessors (SMs)
A GPU consists of multiple **Streaming Multiprocessors (SMs)**. Each SM contains:
- Multiple CUDA cores (32-128 depending on architecture)
- Shared memory / L1 cache (~48-164 KB)
- Register file (~64K 32-bit registers)
- Warp schedulers
- Special function units (SFUs)

### Warps
Threads are organized in groups of 32 called **warps**. All threads in a warp execute the same instruction simultaneously (SIMT — Single Instruction, Multiple Threads). This is why branch divergence within a warp is costly — both paths must be executed sequentially.

### Thread Blocks
A **thread block** is a group of threads that can cooperate via shared memory and synchronize using __syncthreads(). A block is assigned to a single SM and cannot migrate. Block sizes are typically multiples of 32 (the warp size).

### Grid
The **grid** is the collection of all thread blocks launched by a single kernel call. Grid dimensions define how many blocks exist in each dimension.

## Memory Hierarchy

| Memory Type | Scope | Speed | Size |
|-------------|-------|-------|------|
| Registers | Per thread | Fastest | ~255 per thread |
| Shared Memory | Per block | ~5ns | 48-164 KB |
| L1 Cache | Per SM | ~30ns | Combined with shared |
| L2 Cache | Device-wide | ~200ns | 4-40 MB |
| Global Memory | Device-wide | ~400ns | 8-80 GB |

The key to high-performance CUDA code is minimizing global memory access and maximizing data reuse through shared memory and registers.

## Key Takeaways

1. **Think in warps**: Always consider that 32 threads execute together
2. **Maximize occupancy**: Launch enough threads to keep the GPU busy
3. **Use shared memory**: Cache frequently accessed data close to the compute units
4. **Coalesce memory accesses**: Consecutive threads should access consecutive memory addresses
    `,
  },
  "memory-coalescing-deep-dive": {
    title: "Memory Coalescing: The #1 GPU Performance Trick",
    date: "May 6, 2026",
    readTime: "8 min",
    content: `
Memory coalescing is the single most impactful optimization for GPU kernels. A coalesced access pattern can be 10-20× faster than a non-coalesced one.

## What is Memory Coalescing?

When a warp (32 threads) accesses global memory, the GPU hardware combines individual thread requests into as few memory transactions as possible. This is called **coalescing**.

**Coalesced (Good):** Thread 0 reads address 0, thread 1 reads address 4, thread 2 reads address 8... The GPU combines this into a single 128-byte transaction.

**Non-Coalesced (Bad):** Thread 0 reads address 0, thread 1 reads address 1024, thread 2 reads address 2048... Each thread triggers a separate memory transaction.

## The Impact

For a matrix stored in row-major order:
- Accessing elements along a **row** → consecutive addresses → coalesced ✓
- Accessing elements along a **column** → strided addresses → NOT coalesced ✗

## How to Fix It

1. **Transpose your data** if your access pattern requires column access
2. **Use shared memory** as a staging buffer to reorganize data
3. **Change your algorithm** to access data in row-major order when possible

## Rule of Thumb

> If consecutive threads in a warp access consecutive memory addresses, the access is coalesced and achieves maximum bandwidth.
    `,
  },
  "shared-memory-bank-conflicts": {
    title: "Shared Memory Bank Conflicts Explained",
    date: "May 4, 2026",
    readTime: "10 min",
    content: `
Shared memory is organized into **banks** — typically 32 banks, each 4 bytes wide. Understanding banks is crucial for avoiding performance-killing conflicts.

## What are Bank Conflicts?

Shared memory is divided into 32 banks. If two or more threads in a warp access different addresses that map to the **same bank**, those accesses are serialized — this is a bank conflict.

**No conflict:** Each thread accesses a different bank (or all threads access the exact same address — broadcast)

**2-way conflict:** Two threads access different addresses in the same bank → 2× slower

**32-way conflict:** All threads access different addresses in the same bank → 32× slower!

## Bank Mapping

Address-to-bank mapping follows: bank = (address / 4) % 32

For a float array: element i maps to bank i % 32.

## Common Patterns

**Stride-1 access (no conflicts):**
sdata[threadIdx.x] — consecutive threads, consecutive banks ✓

**Stride-2 access (no conflicts on modern GPUs):**
sdata[2 * threadIdx.x] — skips every other bank, but still OK on Kepler+

**Stride-32 access (maximum conflicts!):**
sdata[32 * threadIdx.x] — all threads hit bank 0 ✗

## The Fix: Padding

Add 1 element of padding per row to shift the bank alignment:
__shared__ float tile[32][32 + 1]; // +1 padding eliminates conflicts
    `,
  },
};

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const post = POSTS[slug];

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">Post Not Found</h1>
          <Link href="/blog" className="text-primary hover:text-primary-glow transition-colors">
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith("## ")) return <h2 key={i} className="font-heading text-2xl font-bold text-text-primary mt-10 mb-4">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith("### ")) return <h3 key={i} className="font-heading text-lg font-bold text-text-primary mt-8 mb-3">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("> ")) return <blockquote key={i} className="border-l-4 border-primary pl-4 italic text-text-secondary my-4">{trimmed.slice(2)}</blockquote>;
      if (trimmed.startsWith("| ")) {
        return <p key={i} className="font-mono text-xs text-text-secondary">{trimmed}</p>;
      }
      if (trimmed.startsWith("- ") || trimmed.match(/^\d+\. /)) {
        const text = trimmed.replace(/^[-\d]+[.)]?\s/, "");
        return <li key={i} className="text-text-secondary text-sm leading-relaxed ml-4 list-disc">{renderInline(text)}</li>;
      }
      return <p key={i} className="text-text-secondary leading-relaxed mb-4">{renderInline(trimmed)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="text-text-primary font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="min-h-screen">
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative max-w-4xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors mb-6">
            ← Back to Blog
          </Link>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {post.title}
          </motion.h1>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime} read</span>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {renderContent(post.content)}
        </div>
      </section>
    </div>
  );
}
