// src/components/layout/GavelIcon.tsx
import type { SVGProps } from 'react';

export const GavelIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2} // Matching landing page version
    stroke="currentColor"
    className={className}
    {...props}
  >
    <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
    <path d="m16 16 6-6"></path>
    <path d="m8 8 6-6"></path>
    <path d="m9 7 8 8"></path>
    <path d="m21 11-8-8"></path>
  </svg>
);
