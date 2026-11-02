import { Kernel } from "@/lib/types";

export const KERNELS: Kernel[] = [
  {
    slug: "matrix-multiplication",
    title: "Matrix Multiplication",
    description:
      "The foundational GPU computing problem. Explore how matrix multiplication evolves from a naive O(N³) implementation to optimized tiled approaches using shared memory, and see the dramatic performance impact of memory coalescing.",
    difficulty: "intermediate",
    tags: ["Linear Algebra", "Shared Memory", "Tiling", "Coalescing"],
    approaches: [
      {
        id: "naive",
        name: "Naive Implementation",
        description:
          "Each thread computes one element of C by iterating through a full row of A and column of B, loading everything from slow global memory.",
        complexity: "O(N³) global memory reads",
        performance: "~2% of peak",
        language: "cuda",
        code: `__global__ void matmul_naive(float* A, float* B, float* C, int N) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < N && col < N) {
        float sum = 0.0f;
        for (int k = 0; k < N; k++) {
            sum += A[row * N + k] * B[k * N + col];
        }
        C[row * N + col] = sum;
    }
}`,
      },
      {
        id: "tiled",
        name: "Tiled (Shared Memory)",
        description:
          "Loads sub-matrices (tiles) into fast shared memory, dramatically reducing redundant global memory accesses. Each tile is reused by all threads in the block.",
        complexity: "O(N³/TILE_SIZE) global reads",
        performance: "~30% of peak",
        language: "cuda",
        code: `#define TILE_SIZE 16

__global__ void matmul_tiled(float* A, float* B, float* C, int N) {
    __shared__ float sA[TILE_SIZE][TILE_SIZE];
    __shared__ float sB[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float sum = 0.0f;

    for (int t = 0; t < (N + TILE_SIZE - 1) / TILE_SIZE; t++) {
        // Load tile into shared memory
        if (row < N && t * TILE_SIZE + threadIdx.x < N)
            sA[threadIdx.y][threadIdx.x] = A[row * N + t * TILE_SIZE + threadIdx.x];
        else
            sA[threadIdx.y][threadIdx.x] = 0.0f;

        if (t * TILE_SIZE + threadIdx.y < N && col < N)
            sB[threadIdx.y][threadIdx.x] = B[(t * TILE_SIZE + threadIdx.y) * N + col];
        else
            sB[threadIdx.y][threadIdx.x] = 0.0f;

        __syncthreads();

        // Compute partial dot product using shared memory
        for (int k = 0; k < TILE_SIZE; k++) {
            sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];
        }
        __syncthreads();
    }

    if (row < N && col < N)
        C[row * N + col] = sum;
}`,
      },
      {
        id: "tiled-walkthrough",
        name: "Tiled — Step by Step",
        description:
          "A beginner-friendly visual walkthrough: understand every line of the tiled kernel from scratch — thread mapping, blockIdx/threadIdx indexing, shared memory, tile loading, barriers, dot-product accumulation, and the t-loop.",
        complexity: "O(N³/TILE_SIZE) global reads",
        performance: "~30% of peak",
        language: "cuda",
        code: `// Same kernel as "Tiled (Shared Memory)"
// This tab walks through it step by step
#define TILE_SIZE 4

__global__ void matmul_tiled(float* A, float* B, float* C, int N) {
    __shared__ float sA[TILE_SIZE][TILE_SIZE];
    __shared__ float sB[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float sum = 0.0f;

    for (int t = 0; t < (N + TILE_SIZE - 1) / TILE_SIZE; t++) {
        sA[threadIdx.y][threadIdx.x] = A[row * N + t * TILE_SIZE + threadIdx.x];
        sB[threadIdx.y][threadIdx.x] = B[(t * TILE_SIZE + threadIdx.y) * N + col];

        __syncthreads(); // barrier 1: tile fully loaded

        for (int k = 0; k < TILE_SIZE; k++)
            sum += sA[threadIdx.y][k] * sB[k][threadIdx.x];

        __syncthreads(); // barrier 2: tile fully consumed
    }

    if (row < N && col < N) C[row * N + col] = sum;
}`,
      },

      {
        id: "coalesced",
        name: "Memory Coalesced",
        description:
          "Optimizes global memory access patterns so consecutive threads access consecutive memory addresses, maximizing memory bandwidth utilization.",
        complexity: "Optimized memory bandwidth",
        performance: "~50% of peak",
        language: "cuda",
        code: `#define TILE_SIZE 16

__global__ void matmul_coalesced(float* A, float* B, float* C, int N) {
    __shared__ float sA[TILE_SIZE][TILE_SIZE];
    __shared__ float sB[TILE_SIZE][TILE_SIZE];

    int bx = blockIdx.x, by = blockIdx.y;
    int tx = threadIdx.x, ty = threadIdx.y;

    int row = by * TILE_SIZE + ty;
    int col = bx * TILE_SIZE + tx;

    float sum = 0.0f;

    for (int ph = 0; ph < (N + TILE_SIZE - 1) / TILE_SIZE; ph++) {
        // Coalesced load: consecutive threads load consecutive elements
        if (row < N && ph * TILE_SIZE + tx < N)
            sA[ty][tx] = A[row * N + ph * TILE_SIZE + tx];
        else
            sA[ty][tx] = 0.0f;

        if (ph * TILE_SIZE + ty < N && col < N)
            sB[ty][tx] = B[(ph * TILE_SIZE + ty) * N + col];
        else
            sB[ty][tx] = 0.0f;

        __syncthreads();

        #pragma unroll
        for (int k = 0; k < TILE_SIZE; k++)
            sum += sA[ty][k] * sB[k][tx];

        __syncthreads();
    }

    if (row < N && col < N)
        C[row * N + col] = sum;
}`,
      },
    ],
  },
  {
    slug: "vector-addition",
    title: "Vector Addition",
    description:
      "The hello world of CUDA. Simple element-wise vector addition that introduces thread indexing, grid-stride loops, and the GPU execution model.",
    difficulty: "beginner",
    tags: ["Basics", "Thread Indexing", "Grid-Stride Loop"],
    approaches: [
      {
        id: "basic",
        name: "Basic Implementation",
        description:
          "One thread per element. Simple thread indexing with bounds checking.",
        complexity: "O(N) — 1 thread per element",
        performance: "Memory bandwidth limited",
        language: "cuda",
        code: `__global__ void vecadd_basic(float* A, float* B, float* C, int N) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < N) {
        C[i] = A[i] + B[i];
    }
}`,
      },
      {
        id: "stride",
        name: "Grid-Stride Loop",
        description:
          "Each thread handles multiple elements using a stride pattern. More flexible and handles any array size with any grid configuration.",
        complexity: "O(N/gridSize) per thread",
        performance: "Better occupancy",
        language: "cuda",
        code: `__global__ void vecadd_stride(float* A, float* B, float* C, int N) {
    int stride = blockDim.x * gridDim.x;
    for (int i = blockIdx.x * blockDim.x + threadIdx.x; i < N; i += stride) {
        C[i] = A[i] + B[i];
    }
}`,
      },
    ],
  },
  {
    slug: "parallel-reduction",
    title: "Parallel Reduction",
    description:
      "Efficiently compute the sum (or any associative operation) of millions of elements in parallel. Explores warp-level primitives and avoiding bank conflicts.",
    difficulty: "advanced",
    tags: ["Reduction", "Warp Shuffle", "Bank Conflicts", "Atomics"],
    approaches: [
      {
        id: "naive",
        name: "Interleaved Reduction",
        description:
          "Basic tree-based reduction with interleaved addressing. Suffers from warp divergence in early iterations.",
        complexity: "O(log N) steps",
        performance: "~20% of peak bandwidth",
        language: "cuda",
        code: `__global__ void reduce_interleaved(float* input, float* output, int N) {
    extern __shared__ float sdata[];

    int tid = threadIdx.x;
    int i = blockIdx.x * blockDim.x + threadIdx.x;

    sdata[tid] = (i < N) ? input[i] : 0.0f;
    __syncthreads();

    for (int s = 1; s < blockDim.x; s *= 2) {
        if (tid % (2 * s) == 0) {
            sdata[tid] += sdata[tid + s];
        }
        __syncthreads();
    }

    if (tid == 0) output[blockIdx.x] = sdata[0];
}`,
      },
      {
        id: "sequential",
        name: "Sequential Addressing",
        description:
          "Eliminates warp divergence by using sequential addressing. Consecutive threads work on consecutive data.",
        complexity: "O(log N) steps, no divergence",
        performance: "~40% of peak bandwidth",
        language: "cuda",
        code: `__global__ void reduce_sequential(float* input, float* output, int N) {
    extern __shared__ float sdata[];

    int tid = threadIdx.x;
    int i = blockIdx.x * blockDim.x + threadIdx.x;

    sdata[tid] = (i < N) ? input[i] : 0.0f;
    __syncthreads();

    for (int s = blockDim.x / 2; s > 0; s >>= 1) {
        if (tid < s) {
            sdata[tid] += sdata[tid + s];
        }
        __syncthreads();
    }

    if (tid == 0) output[blockIdx.x] = sdata[0];
}`,
      },
      {
        id: "warp-shuffle",
        name: "Warp Shuffle",
        description:
          "Uses warp-level shuffle instructions for the final 32 elements, avoiding shared memory and __syncthreads entirely for intra-warp reduction.",
        complexity: "O(log N) with warp intrinsics",
        performance: "~70% of peak bandwidth",
        language: "cuda",
        code: `__inline__ __device__ float warpReduce(float val) {
    for (int offset = warpSize / 2; offset > 0; offset >>= 1)
        val += __shfl_down_sync(0xffffffff, val, offset);
    return val;
}

__global__ void reduce_warp_shuffle(float* input, float* output, int N) {
    extern __shared__ float sdata[];

    int tid = threadIdx.x;
    int i = blockIdx.x * blockDim.x + threadIdx.x;

    float val = (i < N) ? input[i] : 0.0f;

    // Warp-level reduction
    val = warpReduce(val);

    // Write warp results to shared memory
    if (tid % warpSize == 0)
        sdata[tid / warpSize] = val;
    __syncthreads();

    // Final reduction by first warp
    if (tid < blockDim.x / warpSize) {
        val = sdata[tid];
        val = warpReduce(val);
    }

    if (tid == 0) output[blockIdx.x] = val;
}`,
      },
    ],
  },
];

export function getKernelBySlug(slug: string): Kernel | undefined {
  return KERNELS.find((k) => k.slug === slug);
}
