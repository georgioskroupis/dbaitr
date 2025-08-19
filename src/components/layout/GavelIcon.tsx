// src/components/layout/GavelHookIcon.tsx // Renamed for clarity
import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export const GavelHookIcon = ({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={strokeWidth} // Use prop or default to 2px
    className={cn("animate-gavel-hook-idle-rotate", className)} // Added idle rotation
    {...props}
  >
    {/* Paths from the original GavelIcon, assuming this is the "gavel-hook" */}
    <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
    <path d="m16 16 6-6"></path>
    <path d="m8 8 6-6"></path>
    <path d="m9 7 8 8"></path>
    <path d="m21 11-8-8"></path>
  </svg>
);
