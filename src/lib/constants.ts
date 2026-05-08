export const SITE = {
  name: "HPC Studio",
  description: "Interactive CUDA kernel visualizations — see what happens inside the GPU",
  url: "https://hpcstudio.dev",
  github: "https://github.com/hpc-studio",
  twitter: "https://twitter.com/hpcstudio",
} as const;

export const NAV_LINKS = [
  { label: "Kernels", href: "/kernels" },
  { label: "Blog", href: "/blog" },
  // { label: "About", href: "/about" },
] as const;

export const DIFFICULTY_COLORS = {
  beginner: { bg: "bg-accent-green/10", text: "text-accent-green", label: "Beginner" },
  intermediate: { bg: "bg-accent-orange/10", text: "text-accent-orange", label: "Intermediate" },
  advanced: { bg: "bg-accent-red/10", text: "text-accent-red", label: "Advanced" },
} as const;

export const ANIMATION_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const;

export const COLORS = {
  background: "#0a0a0f",
  surface: "#12121a",
  surfaceElevated: "#1a1a2e",
  borderSubtle: "#2a2a3e",
  primary: "#6366f1",
  primaryGlow: "#818cf8",
  secondary: "#22d3ee",
  accentGreen: "#4ade80",
  accentOrange: "#fb923c",
  accentRed: "#f87171",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
} as const;
