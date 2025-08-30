// src/components/layout/Logo.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BrandTooltip } from '@/components/branding/BrandTooltip';

interface LogoProps {
  className?: string;
  width?: number; // width is optional when height is provided
  height?: number; // optional explicit height (will scale width by aspect ratio)
  href?: string;
  sizes?: string; // (unused when fluid=true with <img/>)
  fluid?: boolean; // If true, image scales to container width (w-full h-auto)
  ratio?: number; // width/height ratio hint to reserve space
}

const DBAITR_SVG_LOGO_URL = "/dbaitr-logo.svg";

export function Logo({ className, width, height, href = "/", sizes, fluid = false, ratio }: LogoProps) {
  // Aspect ratio approx 4.5:1 (width / 4.5 for height)
  // For an SVG, it's often better to let the SVG scale naturally if height is not explicitly constrained by parent,
  // but for next/image, providing both is good for layout shift prevention.
  const aspectRatio = ratio && ratio > 0 ? ratio : 4.5; 
  const computed = (() => {
    if (height && height > 0) {
      const w = Math.round(height * aspectRatio);
      return { width: w, height };
    }
    const w = width || 120; // sensible default
    const h = Math.round(w / aspectRatio);
    return { width: w, height: h };
  })();

  return (
    <BrandTooltip>
      <Link
        href={href}
        className={cn("flex items-center text-foreground hover:opacity-90 transition-opacity", className)}
      >
        <div
          style={{
            width: fluid ? '100%' : (height ? 'auto' : `${computed.width}px`),
            height: height ? `${computed.height}px` : undefined,
            aspectRatio: `${computed.width} / ${computed.height}`,
            display: 'block',
          }}
        >
          <img
            src={DBAITR_SVG_LOGO_URL}
            alt="dbaitr logo"
            width={computed.width}
            height={computed.height}
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      </Link>
    </BrandTooltip>
  );
}
