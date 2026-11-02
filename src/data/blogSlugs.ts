// Slugs of every blog post. Used to pre-render /blog/[slug] for static export.
// Keep in sync with BLOG_POSTS in src/app/blog/page.tsx.
export const BLOG_SLUGS = [
  "cuda-graphs-explained",
  "understanding-gpu-architecture",
  "memory-coalescing-deep-dive",
  "shared-memory-bank-conflicts",
] as const;
