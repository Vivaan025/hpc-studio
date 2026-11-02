"use client";

import { useMemo } from "react";

interface CodeLine {
  tag: string;
  html: string;
}

interface SimulationCodePanelProps {
  lines: CodeLine[];
  highlightTags: string[];
  filename?: string;
}

export default function SimulationCodePanel({
  lines,
  highlightTags,
  filename = "kernel.cu",
}: SimulationCodePanelProps) {
  const tagSet = useMemo(() => new Set(highlightTags), [highlightTags]);

  return (
    <div className="border border-[#dccfb2] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#dccfb2]">
        <span className="text-[10px] font-mono text-[#967f5e] uppercase tracking-wider">
          Source
        </span>
        <span className="text-[10px] font-mono text-[#bfad88]">{filename}</span>
      </div>

      {/* Code */}
      <pre className="py-3 overflow-x-auto text-[12px] leading-[1.7] font-mono">
        {lines.map((line, i) => {
          const isHighlighted = line.tag && tagSet.has(line.tag);
          return (
            <span
              key={i}
              className={`block px-4 pl-12 relative whitespace-pre transition-colors duration-150 ${
                isHighlighted
                  ? "bg-[#ebe0ca] border-l-[3px] border-l-[#2a1c0d]"
                  : ""
              }`}
            >
              <span
                className={`absolute left-0 w-9 text-right pr-3 text-[10px] select-none ${
                  isHighlighted ? "text-[#2a1c0d] font-semibold" : "text-[#bfad88]"
                }`}
              >
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }} />
            </span>
          );
        })}
      </pre>
    </div>
  );
}
