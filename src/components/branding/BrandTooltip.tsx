"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BrandTooltipProps {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
}

export function BrandTooltip({ children, side = 'top', align = 'center', sideOffset = 8, alignOffset = 0, avoidCollisions = false, collisionPadding }: BrandTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} avoidCollisions={avoidCollisions} {...(collisionPadding !== undefined ? { collisionPadding } : {})} className="max-w-xs bg-black/90 border-white/10">
          <div className="text-left">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-base font-semibold text-white">dbaitr</span>
              <span className="text-white/60 text-xs">/dɪˈbeɪ.tər/</span>
              <span className="text-primary text-[10px] font-medium uppercase tracking-wide">noun</span>
            </div>
            <p className="mt-1 text-xs text-white/80 italic">
              <span className="text-white/60 mr-1">1.</span>
              Wordplay on <span className="text-primary font-semibold">debater</span> (one who debates) + <span className="text-primary font-semibold">de-baiter</span> (one who removes bait).
            </p>
            <p className="mt-1 text-xs text-white/90 leading-snug">
              <span className="text-white/60 mr-1">2.</span>
              A person who argues with <span className="text-primary font-semibold">clarity</span>, <span className="text-primary font-semibold">civility</span>, and <span className="text-primary font-semibold">evidence</span>—while stripping away click‑bait, noise, and manipulation in the digital world.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
