import { AnimationDefinition } from "@/lib/types";

export const matmulNaiveAnimation: AnimationDefinition = {
  kernelSlug: "matrix-multiplication",
  approach: "naive",
  gridDim: { x: 2, y: 2, z: 1 },
  blockDim: { x: 4, y: 4, z: 1 },
  memoryLayout: {
    matrices: [
      { id: "A", name: "Matrix A", rows: 8, cols: 8, type: "global", color: "#6366f1" },
      { id: "B", name: "Matrix B", rows: 8, cols: 8, type: "global", color: "#22d3ee" },
      { id: "C", name: "Matrix C", rows: 8, cols: 8, type: "global", color: "#4ade80" },
    ],
  },
  steps: [
    {
      id: 0,
      label: "Launch Kernel",
      description: "The GPU launches a 2×2 grid of 4×4 thread blocks. Each thread will compute one element of matrix C.",
      highlightedCodeLines: [1, 2, 3],
      activeThreads: [],
      activeBlocks: [
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 },
      ],
      memoryOps: [],
      duration: 2000,
    },
    {
      id: 1,
      label: "Calculate Thread Position",
      description: "Each thread calculates its global row and column index. Thread (0,0) in block (0,0) maps to C[0][0], thread (1,0) maps to C[0][1], etc.",
      highlightedCodeLines: [2, 3],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [],
      duration: 2000,
    },
    {
      id: 2,
      label: "Begin Dot Product — Load from A",
      description: "Thread (0,0) begins reading row 0 of matrix A from global memory. Each element is loaded one at a time — this is slow!",
      highlightedCodeLines: [7],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 3 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "global",
          dest: "register",
          cells: [
            { row: 0, col: 0, matrixId: "A" },
            { row: 0, col: 1, matrixId: "A" },
            { row: 0, col: 2, matrixId: "A" },
            { row: 0, col: 3, matrixId: "A" },
          ],
          color: "#6366f1",
          label: "Read row from A",
        },
      ],
      duration: 2500,
    },
    {
      id: 3,
      label: "Load from B",
      description: "Simultaneously, the thread reads column 0 of matrix B from global memory. For an 8×8 matrix, that's 8 global memory reads per element of C.",
      highlightedCodeLines: [7],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 3 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "global",
          dest: "register",
          cells: [
            { row: 0, col: 0, matrixId: "B" },
            { row: 1, col: 0, matrixId: "B" },
            { row: 2, col: 0, matrixId: "B" },
            { row: 3, col: 0, matrixId: "B" },
          ],
          color: "#22d3ee",
          label: "Read column from B",
        },
      ],
      duration: 2500,
    },
    {
      id: 4,
      label: "Multiply & Accumulate",
      description: "The thread multiplies corresponding elements and accumulates into sum. This is the dot product: sum += A[row][k] * B[k][col] for each k.",
      highlightedCodeLines: [7],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [],
      duration: 2000,
    },
    {
      id: 5,
      label: "Write Result to C",
      description: "After completing the full dot product, the thread writes its computed value to the corresponding element in matrix C in global memory.",
      highlightedCodeLines: [8],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "write",
          source: "register",
          dest: "global",
          cells: [
            { row: 0, col: 0, matrixId: "C" },
            { row: 0, col: 1, matrixId: "C" },
            { row: 1, col: 0, matrixId: "C" },
            { row: 1, col: 1, matrixId: "C" },
          ],
          color: "#4ade80",
          label: "Write result to C",
        },
      ],
      duration: 2000,
    },
    {
      id: 6,
      label: "All Blocks Complete",
      description: "All thread blocks execute the same kernel code in parallel. The entire matrix C is now computed. Notice: every thread read entire rows/columns from global memory — very redundant!",
      highlightedCodeLines: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 1, y: 0 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 0, y: 1 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 1, y: 1 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 },
      ],
      memoryOps: [
        {
          type: "write",
          source: "register",
          dest: "global",
          cells: Array.from({ length: 16 }, (_, i) => ({
            row: Math.floor(i / 4),
            col: i % 4,
            matrixId: "C",
          })),
          color: "#4ade80",
          label: "All results written",
        },
      ],
      duration: 3000,
    },
  ],
};

export const matmulTiledAnimation: AnimationDefinition = {
  kernelSlug: "matrix-multiplication",
  approach: "tiled",
  gridDim: { x: 2, y: 2, z: 1 },
  blockDim: { x: 4, y: 4, z: 1 },
  memoryLayout: {
    matrices: [
      { id: "A", name: "Matrix A", rows: 8, cols: 8, type: "global", color: "#6366f1" },
      { id: "B", name: "Matrix B", rows: 8, cols: 8, type: "global", color: "#22d3ee" },
      { id: "C", name: "Matrix C", rows: 8, cols: 8, type: "global", color: "#4ade80" },
      { id: "sA", name: "Shared A", rows: 4, cols: 4, type: "shared", color: "#f59e0b" },
      { id: "sB", name: "Shared B", rows: 4, cols: 4, type: "shared", color: "#ec4899" },
    ],
  },
  steps: [
    {
      id: 0,
      label: "Declare Shared Memory",
      description: "Each block allocates shared memory arrays sA[16][16] and sB[16][16]. Shared memory is ~100x faster than global memory but limited to ~48KB per block.",
      highlightedCodeLines: [3, 4],
      activeThreads: [],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [],
      duration: 2000,
    },
    {
      id: 1,
      label: "Begin Tile Loop",
      description: "The outer loop iterates over tiles. For an 8×8 matrix with TILE_SIZE=4, we need 2 iterations (tiles) to cover the full K dimension.",
      highlightedCodeLines: [10],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [],
      duration: 2000,
    },
    {
      id: 2,
      label: "Load Tile 0 of A → Shared Memory",
      description: "All 16 threads in the block cooperatively load a 4×4 tile of matrix A from global memory into shared memory sA. Each thread loads exactly one element.",
      highlightedCodeLines: [12, 13],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "global",
          dest: "shared",
          cells: Array.from({ length: 16 }, (_, i) => ({
            row: Math.floor(i / 4),
            col: i % 4,
            matrixId: "A",
          })),
          color: "#f59e0b",
          label: "A tile → shared sA",
        },
      ],
      duration: 2500,
    },
    {
      id: 3,
      label: "Load Tile 0 of B → Shared Memory",
      description: "Similarly, threads cooperatively load a 4×4 tile of matrix B into shared memory sB. This is coalesced — consecutive threads load consecutive columns.",
      highlightedCodeLines: [16, 17],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "global",
          dest: "shared",
          cells: Array.from({ length: 16 }, (_, i) => ({
            row: Math.floor(i / 4),
            col: i % 4,
            matrixId: "B",
          })),
          color: "#ec4899",
          label: "B tile → shared sB",
        },
      ],
      duration: 2500,
    },
    {
      id: 4,
      label: "__syncthreads()",
      description: "CRITICAL: All threads in the block must reach this barrier before proceeding. This ensures the entire tile is loaded before any thread starts computing.",
      highlightedCodeLines: [20],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [],
      duration: 1500,
    },
    {
      id: 5,
      label: "Compute with Shared Memory Tile",
      description: "Now each thread computes a partial dot product using data from shared memory (fast!) instead of global memory (slow!). Each element of sA and sB is reused by multiple threads.",
      highlightedCodeLines: [22, 23],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "shared",
          dest: "register",
          cells: Array.from({ length: 4 }, (_, i) => ({
            row: 0,
            col: i,
            matrixId: "sA",
          })),
          color: "#f59e0b",
          label: "Read from shared sA",
        },
        {
          type: "read",
          source: "shared",
          dest: "register",
          cells: Array.from({ length: 4 }, (_, i) => ({
            row: i,
            col: 0,
            matrixId: "sB",
          })),
          color: "#ec4899",
          label: "Read from shared sB",
        },
      ],
      duration: 2500,
    },
    {
      id: 6,
      label: "Load Tile 1 & Compute",
      description: "The loop continues with the next tile (k=1). Load the second 4×4 tile into shared memory and accumulate the remaining partial products.",
      highlightedCodeLines: [10, 12, 13, 16, 17, 22, 23],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [{ x: 0, y: 0 }],
      memoryOps: [
        {
          type: "read",
          source: "global",
          dest: "shared",
          cells: Array.from({ length: 16 }, (_, i) => ({
            row: Math.floor(i / 4),
            col: 4 + (i % 4),
            matrixId: "A",
          })),
          color: "#f59e0b",
          label: "A tile 1 → shared",
        },
      ],
      duration: 2500,
    },
    {
      id: 7,
      label: "Write Final Results",
      description: "After all tiles are processed, each thread writes its accumulated sum to global memory. Key insight: We reduced global memory reads from 2N to 2N/TILE_SIZE per element!",
      highlightedCodeLines: [27, 28],
      activeThreads: [
        { blockIdx: { x: 0, y: 0 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 1, y: 0 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 0, y: 1 }, threadStart: 0, threadEnd: 15 },
        { blockIdx: { x: 1, y: 1 }, threadStart: 0, threadEnd: 15 },
      ],
      activeBlocks: [
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 },
      ],
      memoryOps: [
        {
          type: "write",
          source: "register",
          dest: "global",
          cells: Array.from({ length: 16 }, (_, i) => ({
            row: Math.floor(i / 4),
            col: i % 4,
            matrixId: "C",
          })),
          color: "#4ade80",
          label: "Write to C",
        },
      ],
      duration: 2500,
    },
  ],
};

export const ANIMATION_MAP: Record<string, Record<string, AnimationDefinition>> = {
  "matrix-multiplication": {
    naive: matmulNaiveAnimation,
    tiled: matmulTiledAnimation,
  },
};

export function getAnimation(
  kernelSlug: string,
  approach: string
): AnimationDefinition | undefined {
  return ANIMATION_MAP[kernelSlug]?.[approach];
}
