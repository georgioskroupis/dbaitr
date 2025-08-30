"use client";

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface Quote { text: string; messageId: string }
interface Evidence { title?: string; url?: string; messageId?: string; domainWeight?: number }
interface Side { summary?: string; topPoints?: string[]; quotes?: Quote[]; evidence?: Evidence[]; unresolved?: string[] }

interface DiscussionOverviewProps {
  overview?: {
    meta?: { confidence?: number; updatedAt?: string; trigger?: string };
    for?: Side;
    against?: Side;
    rationaleShort?: string;
  } | null;
}

function SideBlock({ title, side }: { title: string; side?: Side }) {
  return (
    <div className="space-y-3">
      <h3 className="text-white/90 font-semibold tracking-tight">{title}</h3>
      {side?.summary && <p className="text-sm text-white/80 leading-relaxed">{side.summary}</p>}
      {side?.topPoints && side.topPoints.length > 0 && (
        <div>
          <p className="text-xs text-white/60 mb-1">Top Points</p>
          <ul className="list-disc list-inside text-sm text-white/80 space-y-1">
            {side.topPoints.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {side?.quotes && side.quotes.length > 0 && (
        <div>
          <p className="text-xs text-white/60 mb-1">Representative Quotes</p>
          <ul className="space-y-1">
            {side.quotes.map((q, i) => (
              <li key={i} className="text-sm text-white/80">
                “{q.text}”{' '}
                {q.messageId && (
                  <a href={`#${q.messageId}`} className="text-rose-300 underline hover:text-white">{q.messageId.replace('msg-', '').slice(0, 6)}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {side?.evidence && side.evidence.length > 0 && (
        <div>
          <p className="text-xs text-white/60 mb-1">Evidence & Sources</p>
          <ul className="space-y-1 text-sm">
            {side.evidence.map((e, i) => (
              <li key={i} className="text-white/80">
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-rose-300 underline hover:text-white">
                    {e.title || e.url}
                  </a>
                ) : (
                  e.title || '—'
                )}
                {e.messageId && (
                  <span className="text-white/50 ml-1">({e.messageId.replace('msg-', '').slice(0, 6)})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {side?.unresolved && side.unresolved.length > 0 && (
        <div>
          <p className="text-xs text-white/60 mb-1">Unresolved Questions</p>
          <ul className="space-y-1 text-sm text-white/80">
            {side.unresolved.map((q, i) => <li key={i}>• {q}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DiscussionOverview({ overview }: DiscussionOverviewProps) {
  if (!overview) return null;
  const confidence = overview?.meta?.confidence ?? 0;

  return (
    <Card className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white tracking-tight">Discussion Overview (For vs Against)</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="About this overview" className="text-white/70 hover:text-white"><Info className="h-4 w-4" /></button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">An AI summary of the current discussion. It updates as the thread evolves.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {confidence < 0.65 && <span className="ml-2 text-[11px] text-white/60">Unclear</span>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <SideBlock title="For" side={overview.for} />
        <SideBlock title="Against" side={overview.against} />
      </div>
    </Card>
  );
}

