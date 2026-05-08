import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ── Kernel data ──
const kernels = [
  {
    slug: "matrix-multiplication",
    title: "Matrix Multiplication",
    difficulty: "intermediate",
    approachCount: 3,
    tags: ["Linear Algebra", "Shared Memory", "Tiling"],
  },
  {
    slug: "vector-addition",
    title: "Vector Addition",
    difficulty: "beginner",
    approachCount: 2,
    tags: ["Basics", "Thread Indexing"],
  },
  {
    slug: "parallel-reduction",
    title: "Parallel Reduction",
    difficulty: "advanced",
    approachCount: 3,
    tags: ["Reduction", "Warp Shuffle", "Atomics"],
  },
];

// ── Routes ──

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "hpc-studio-api", version: "1.0.0" });
});

app.get("/api/kernels", (_req, res) => {
  res.json({ kernels });
});

app.get("/api/kernels/:slug", (req, res) => {
  const kernel = kernels.find((k) => k.slug === req.params.slug);
  if (!kernel) {
    res.status(404).json({ error: "Kernel not found" });
    return;
  }
  res.json({ kernel });
});

// ── Start server ──

app.listen(PORT, () => {
  console.log(`\n  ⚡ HPC Studio API running at http://localhost:${PORT}\n`);
});
