"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CodeBlockProps {
  code: string;
  language?: string;
  highlightedLines?: number[];
  showLineNumbers?: boolean;
  title?: string;
}

export default function CodeBlock({
  code,
  language = "cuda",
  highlightedLines = [],
  showLineNumbers = true,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map cuda to cpp for syntax highlighting (Prism doesn't have cuda)
  const prismLanguage = language === "cuda" ? "cpp" : language;

  return (
    <div className="code-block group relative">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-accent-red/60" />
              <div className="w-3 h-3 rounded-full bg-accent-orange/60" />
              <div className="w-3 h-3 rounded-full bg-accent-green/60" />
            </div>
            <span className="text-xs font-mono text-text-muted ml-2">
              {title}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-all opacity-0 group-hover:opacity-100"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-accent-green"
                >
                  ✓ Copied
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  Copy
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {/* Code */}
      <SyntaxHighlighter
        language={prismLanguage}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineProps={(lineNumber) => {
          const isHighlighted = highlightedLines.includes(lineNumber);
          return {
            style: {
              backgroundColor: isHighlighted
                ? "rgba(99, 102, 241, 0.12)"
                : "transparent",
              borderLeft: isHighlighted
                ? "3px solid #6366f1"
                : "3px solid transparent",
              display: "block",
              paddingLeft: "0.5rem",
              transition: "all 0.3s ease",
            },
          };
        }}
        customStyle={{
          background: "transparent",
          padding: "1rem 0.5rem",
          margin: 0,
          fontSize: "0.82rem",
          lineHeight: 1.7,
        }}
        codeTagProps={{
          style: {
            fontFamily: "var(--font-mono), JetBrains Mono, monospace",
          },
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
