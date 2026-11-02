"use client";

interface Variable {
  name: string;
  value: string | number;
  highlight?: boolean;
  dim?: boolean;
}

interface ThreadInfoPanelProps {
  variables: Variable[];
  title?: string;
}

export default function ThreadInfoPanel({ variables, title = "CUDA Context" }: ThreadInfoPanelProps) {
  if (variables.length === 0) return null;

  return (
    <div className="border border-[#dccfb2] bg-[#f3eadb] p-3">
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#bfad88] mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {variables.map((v, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span
              className={`text-[11px] font-mono ${
                v.dim ? "text-[#bfad88]" : "text-[#967f5e]"
              }`}
            >
              {v.name}
            </span>
            <span className="text-[11px] font-mono text-[#967f5e]">=</span>
            <span
              className={`text-[11px] font-mono font-semibold ${
                v.highlight
                  ? "text-[#2a1c0d] bg-[#e5d9c0] px-1 -mx-0.5"
                  : v.dim
                  ? "text-[#bfad88]"
                  : "text-[#2a1c0d]"
              }`}
            >
              {v.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
