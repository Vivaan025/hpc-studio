export const SITE = {
  name: "HPC Studio",
  description: "Interactive CUDA kernel visualizations — see what happens inside the GPU",
  url: "https://hpcstudio.dev",
  github: "https://github.com/vivaan025/hpc-studio",
  twitter: "https://x.com/LakhaniVivaan",
} as const;

export const NAV_LINKS = [
  { label: "Kernels", href: "/kernels" },
  { label: "Blog", href: "/blog" },
] as const;

export const DIFFICULTY_COLORS = {
  beginner: { bg: "bg-surface", text: "text-text-secondary", label: "Beginner" },
  intermediate: { bg: "bg-surface-elevated", text: "text-text-primary", label: "Intermediate" },
  advanced: { bg: "bg-primary", text: "text-white", label: "Advanced" },
} as const;

export const ANIMATION_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const;

export const COLORS = {
  background: "#f7f0e1",
  surface: "#f1e7d5",
  surfaceElevated: "#ebe0ca",
  borderSubtle: "#dccfb2",
  borderStrong: "#cbbb98",
  primary: "#2a1c0d",
  primaryHover: "#41301c",
  secondary: "#5e4a30",
  accent: "#1c1206",
  textPrimary: "#2a1c0d",
  textSecondary: "#5e4a30",
  textMuted: "#967f5e",
} as const;
