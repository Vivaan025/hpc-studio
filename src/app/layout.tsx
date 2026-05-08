import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HPC Studio — Interactive CUDA Kernel Visualizations",
    template: "%s | HPC Studio",
  },
  description:
    "Learn GPU programming through interactive, animated visualizations of CUDA kernels. See thread blocks, memory access patterns, and warp execution come alive.",
  keywords: [
    "CUDA",
    "GPU programming",
    "kernel visualization",
    "HPC",
    "parallel computing",
    "matrix multiplication",
    "NVIDIA",
  ],
  authors: [{ name: "HPC Studio" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HPC Studio",
    title: "HPC Studio — Interactive CUDA Kernel Visualizations",
    description:
      "Learn GPU programming through interactive, animated visualizations of CUDA kernels.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HPC Studio",
    description:
      "Interactive CUDA kernel visualizations — see what happens inside the GPU.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
