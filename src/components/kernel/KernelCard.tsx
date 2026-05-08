"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Kernel } from "@/lib/types";
import { DIFFICULTY_COLORS } from "@/lib/constants";

interface KernelCardProps {
  kernel: Kernel;
  index: number;
}

export default function KernelCard({ kernel, index }: KernelCardProps) {
  const diff = DIFFICULTY_COLORS[kernel.difficulty];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Link href={`/kernels/${kernel.slug}`}>
        <div className="gradient-border group cursor-pointer h-full">
          <div className="relative bg-surface rounded-[11px] p-6 h-full flex flex-col hover:bg-surface-elevated transition-colors duration-300">
            {/* GPU grid animation preview */}
            <div className="relative h-32 mb-4 rounded-lg bg-background overflow-hidden">
              <div className="absolute inset-0 dot-grid opacity-50" />
              {/* Mini grid preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-5 h-5 rounded-sm"
                      style={{ backgroundColor: `${diff.text === "text-accent-green" ? "#4ade80" : diff.text === "text-accent-orange" ? "#fb923c" : "#f87171"}15` }}
                      animate={{
                        backgroundColor: [
                          `rgba(99, 102, 241, 0.1)`,
                          `rgba(99, 102, 241, 0.4)`,
                          `rgba(99, 102, 241, 0.1)`,
                        ],
                      }}
                      transition={{
                        delay: i * 0.1,
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                <span className="text-xs text-primary font-medium">Explore →</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${diff.bg} ${diff.text}`}
                >
                  {diff.label}
                </span>
                <span className="text-xs text-text-muted">
                  {kernel.approaches.length} approaches
                </span>
              </div>

              <h3 className="font-heading text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">
                {kernel.title}
              </h3>

              <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-4">
                {kernel.description}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {kernel.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-xs bg-border-subtle/30 text-text-muted"
                >
                  {tag}
                </span>
              ))}
              {kernel.tags.length > 3 && (
                <span className="px-2 py-0.5 rounded-md text-xs bg-border-subtle/30 text-text-muted">
                  +{kernel.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
