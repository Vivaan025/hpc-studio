"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { useState } from "react";

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

  const prismLanguage = language === "cuda" ? "cpp" : language;

  return (
    <div className="border border-[#dccfb2] group relative">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#dccfb2]">
          <span className="text-[10px] font-mono text-[#967f5e] uppercase tracking-wider">
            {title}
          </span>
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-[#967f5e] hover:text-[#5e4a30] transition-colors opacity-0 group-hover:opacity-100"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      )}

      <SyntaxHighlighter
        language={prismLanguage}
        style={oneLight}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineProps={(lineNumber) => {
          const isHighlighted = highlightedLines.includes(lineNumber);
          return {
            style: {
              backgroundColor: isHighlighted ? "rgba(0, 0, 0, 0.04)" : "transparent",
              borderLeft: isHighlighted ? "3px solid #2a1c0d" : "3px solid transparent",
              display: "block",
              paddingLeft: "0.5rem",
              transition: "all 0.15s ease",
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
