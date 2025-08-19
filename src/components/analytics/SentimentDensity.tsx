"use client";

import * as React from 'react';

interface Props {
  bins: number[]; // length 101
  mean?: number;
  height?: number;
}

export function SentimentDensity({ bins, mean, height = 80 }: Props) {
  const width = 300;
  const max = Math.max(1, ...bins);
  const points = bins.map((v, i) => {
    const x = (i / 100) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} height={height} aria-label="Sentiment distribution">
        {/* Bucket overlays */}
        {[0,21,41,61,81].map((start, idx) => {
          const end = idx===4 ? 100 : [20,40,60,80][idx];
          const x1 = (start/100)*width;
          const w = ((end-start)/100)*width;
          return <rect key={idx} x={x1} y={0} width={w} height={height} fill={idx%2===0? '#ffffff06':'#ffffff0a'} />
        })}
        {/* Line */}
        <polyline fill="none" stroke="#66e3a5" strokeWidth={2} points={points} />
        {/* Mean marker */}
        {typeof mean === 'number' && (
          <line x1={(mean/100)*width} x2={(mean/100)*width} y1={0} y2={height} stroke="#e5e7eb" strokeDasharray="4 4" strokeWidth={1} />
        )}
        {/* Neutral marker */}
        <line x1={(50/100)*width} x2={(50/100)*width} y1={0} y2={height} stroke="#f59e0b" strokeDasharray="2 4" strokeWidth={1} />
      </svg>
      <div className="flex justify-between text-[10px] text-white/60">
        <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
      </div>
    </div>
  );
}

