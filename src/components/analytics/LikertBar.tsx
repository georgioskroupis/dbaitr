"use client";

import * as React from 'react';

interface Props {
  bins: number[]; // length 101 (0..100)
  mean?: number;
  height?: number; // total SVG height
}

const LABELS = [
  'Very Negative',
  'Negative',
  'Neutral',
  'Positive',
  'Very Positive',
] as const;

function groupCounts(bins: number[]): number[] {
  const g = [0, 0, 0, 0, 0];
  for (let i = 0; i <= 100; i++) {
    const v = bins[i] || 0;
    if (i <= 20) g[0] += v;
    else if (i <= 40) g[1] += v;
    else if (i <= 60) g[2] += v;
    else if (i <= 80) g[3] += v;
    else g[4] += v;
  }
  return g;
}

export function LikertBar({ bins, mean, height = 80 }: Props) {
  const total = Math.max(1, bins.reduce((a, b) => a + (b || 0), 0));
  const groups = groupCounts(bins);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; text: string } | null>(null);

  const width = 320;
  const maxBin = Math.max(1, ...bins);
  const points = bins
    .map((v, i) => {
      const x = (i / 100) * width;
      const y = height - (v / maxBin) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const barWidth = width / 5;

  const onBarMove = (idx: number) => (e: React.MouseEvent) => {
    setHoverIdx(idx);
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);
    const y = e.clientY - (rect?.top || 0) - 8;
    const pct = Math.round((groups[idx] / total) * 100);
    setTooltip({ x, y, text: `${LABELS[idx]} · ${pct}% (${groups[idx]})` });
  };
  const clearHover = () => {
    setHoverIdx(null);
    setTooltip(null);
  };

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} height={height} aria-label="Sentiment (Likert + density)">
        {/* Likert bars */}
        {groups.map((count, idx) => {
          const x = idx * barWidth;
          const pct = count / total;
          const barH = Math.max(2, pct * height);
          const y = height - barH;
          // Color ramp from red->orange->gray->blue->green
          const colors = ['#ef4444', '#f59e0b', '#9ca3af', '#60a5fa', '#22c55e'];
          const base = colors[idx];
          const fill = hoverIdx === idx ? base : base + 'CC';
          return (
            <g key={idx} onMouseMove={onBarMove(idx)} onMouseLeave={clearHover}>
              <rect x={x + 2} y={y} width={barWidth - 4} height={barH} rx={4} fill={fill} />
            </g>
          );
        })}
        {/* Density overlay */}
        <polyline fill="none" stroke="#ffffff" opacity="0.7" strokeWidth={1.5} points={points} />
        {/* Mean marker */}
        {typeof mean === 'number' && (
          <line x1={(mean / 100) * width} x2={(mean / 100) * width} y1={0} y2={height} stroke="#e5e7eb" strokeDasharray="4 4" strokeWidth={1} />
        )}
      </svg>
      {/* Labels row */}
      <div className="mt-1 grid grid-cols-5 gap-1 text-[10px] text-white/70">
        {LABELS.map((l, i) => (
          <div key={i} className="text-center truncate">{l}</div>
        ))}
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded bg-black/80 px-2 py-1 text-xs text-white border border-white/10"
          style={{ left: Math.max(0, Math.min(width - 120, tooltip.x - 60)), top: Math.max(0, tooltip.y - 28) }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

