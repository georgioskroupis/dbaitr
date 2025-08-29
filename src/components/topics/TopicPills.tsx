"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

type Cat = 'tone'|'style'|'outcome'|'substance'|'engagement'|'argumentation';

const TOOLTIPS: Record<string, Record<string, string>> = {
  tone: { heated: 'High emotional intensity or confrontational tone.', calm: 'Measured, low-emotion delivery.' },
  style: { structured: 'Organized flow with visible structure and turn-taking.', informal: 'Casual, spontaneous exchanges with loose structure.' },
  outcome: { controversial: 'Clear divergence of stances among participants.', consensus: 'Broad alignment across participants.' },
  substance: { evidence: 'Claims supported by sources, data, or citations.', opinion: 'Personal views dominate; limited evidence provided.' },
  engagement: { active: 'High participation and recent contributions.', dormant: 'Little participation and low recency of contributions.' },
  argumentation: { solid: 'Well-reasoned arguments with clear claim–evidence–warrant.', weak: 'Poorly supported or fallacy-prone arguments.' },
};

function trendGlyph(delta?: number) {
  if (typeof delta !== 'number') return '·';
  if (delta > 0.03) return '↑';
  if (delta < -0.03) return '↓';
  return '·';
}

function percent(x?: number) {
  if (typeof x !== 'number') return '—';
  return `${Math.round(x * 100)}%`;
}

export function TopicPills({ analysis }: { analysis?: any }) {
  const items = useMemo(() => {
    const cats: Cat[] = ['tone','style','outcome','substance','engagement','argumentation'];
    return cats.map(cat => ({ key: cat, data: analysis?.categories?.[cat] }));
  }, [analysis]);

  const empty = !analysis || items.every(i => !i.data || (i.data.confidence ?? 0) < 0.65);
  if (empty) {
    return (
      <div className="sticky top-14 z-20 w-full">
        <div className="flex flex-wrap gap-2 items-center p-2 rounded-lg bg-white/5 border border-white/10 text-white/70">
          Not enough data yet
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-14 z-20 w-full">
      <TooltipProvider>
        <div className="flex flex-wrap gap-2 items-center p-2 rounded-lg bg-white/5 border border-white/10">
          {items.map(({ key, data }) => {
            const val = String(data?.value || '');
            if (!val) return (
              <Badge key={key} variant="outline" className="bg-white/5 text-white/70 border-white/10">{key}</Badge>
            );
            const tip = TOOLTIPS[key]?.[val] || undefined;
            const conf = percent(data?.confidence);
            const trend = trendGlyph(data?.trend24h);
            const label = `${key[0].toUpperCase()}${key.slice(1)}: ${val}`;
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-white/5 text-white border-white/20 hover:bg-white/10">
                    <span className="capitalize mr-1">{key}:</span>
                    <span className="capitalize font-semibold mr-2">{val}</span>
                    <span className="text-xs text-white/70">{conf}</span>
                    <span className="mx-1 text-white/50">{trend}</span>
                  </Badge>
                </TooltipTrigger>
                {tip && <TooltipContent>{tip}</TooltipContent>}
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

