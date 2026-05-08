// ── Kernel Types ──

export interface Kernel {
  slug: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  approaches: Approach[];
  thumbnail?: string;
}

export interface Approach {
  id: string;
  name: string;
  description: string;
  complexity: string;
  performance: string;
  code: string;
  language: string;
}

// ── Animation Types ──

export interface AnimationDefinition {
  kernelSlug: string;
  approach: string;
  gridDim: Dim3;
  blockDim: Dim3;
  steps: AnimationStep[];
  memoryLayout: MemoryLayout;
}

export interface Dim3 {
  x: number;
  y: number;
  z: number;
}

export interface AnimationStep {
  id: number;
  label: string;
  description: string;
  highlightedCodeLines: number[];
  activeThreads: ThreadRange[];
  memoryOps: MemoryOperation[];
  activeBlocks: BlockIndex[];
  duration: number;
}

export interface ThreadRange {
  blockIdx: BlockIndex;
  threadStart: number;
  threadEnd: number;
}

export interface BlockIndex {
  x: number;
  y: number;
}

export interface MemoryOperation {
  type: "read" | "write";
  source: MemoryType;
  dest: MemoryType;
  cells: CellAddress[];
  color: string;
  label?: string;
}

export type MemoryType = "global" | "shared" | "local" | "register";

export interface CellAddress {
  row: number;
  col: number;
  matrixId: string;
}

export interface MemoryLayout {
  matrices: MatrixDef[];
}

export interface MatrixDef {
  id: string;
  name: string;
  rows: number;
  cols: number;
  type: MemoryType;
  color: string;
}

// ── Blog Types ──

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
  readTime: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

// ── Animation Engine State ──

export interface AnimationState {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  speed: number;
  approach: string;
  progress: number;
}
