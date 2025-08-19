"use client";

import * as React from 'react';

export function Thermometer({ score, height = 8 }: { score: number; height?: number }) {
  const width = 120;
  const x = Math.max(0, Math.min(100, score)) / 100 * width;
  return (
    <svg width={width} height={height+6} aria-label={`Sentiment score ${score}`}>
      <rect x={0} y={3} width={width} height={height} rx={height/2} fill="#222" stroke="#444" />
      {/* gradient-like bands */}
      {[0,20,40,60,80].map((s,i)=>{
        const w=20/100*width; const xx=s/100*width; return <rect key={i} x={xx} y={3} width={w} height={height} fill={i%2? '#ffffff10':'#ffffff06'} />
      })}
      {/* marker */}
      <line x1={x} x2={x} y1={1} y2={height+5} stroke="#66e3a5" strokeWidth={2} />
    </svg>
  );
}

