import Link from "next/link";
import { BlogPost } from "@/lib/types";

const BLOG_POSTS: BlogPost[] = [
  {
    slug: "cuda-graphs-explained",
    title: "CUDA Graphs: Stop Paying the Launch Tax",
    date: "2026-10-31",
    author: "HPC Studio",
    tags: ["CUDA Graphs", "Performance", "Streams"],
    excerpt: "A real 30-kernel pipeline, timed before and after converting it to a CUDA Graph on a laptop GPU. 6.4× faster with bit-identical output, plus the case where it does nothing. With step-by-step animations of capture, instantiate, and replay.",
    readTime: "15 min",
    difficulty: "beginner",
  },
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

const diffLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function BlogPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <section className="py-12 border-b border-[#dccfb2]">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#2a1c0d] mb-2">
          Blog
        </h1>
        <p className="text-sm text-[#5e4a30]">
          Deep dives into GPU computing concepts, optimization techniques, and CUDA programming patterns.
        </p>
      </section>

      <div className="space-y-0 border-t border-[#dccfb2]">
        {BLOG_POSTS.map((post) => (
          <article key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block py-6 border-b border-[#dccfb2] group"
            >
              <div className="flex items-center gap-3 mb-1.5 text-xs text-[#967f5e] font-mono">
                <span>{diffLabel[post.difficulty]}</span>
                <span>·</span>
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className="font-heading text-base font-semibold text-[#2a1c0d] mb-1.5 group-hover:underline">
                {post.title}
              </h2>
              <p className="text-sm text-[#5e4a30] leading-relaxed mb-2">
                {post.excerpt}
              </p>
              <div className="flex gap-3">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs text-[#967f5e] font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
