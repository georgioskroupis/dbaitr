// src/components/layout/Logo.tsx
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width: number; // Made width required as per prompt
  href?: string;
}

const DBAITR_SVG_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-logo.svg?alt=media&token=4da903b9-22ac-486a-89f3-145bd84bec11";

export function Logo({ className, width, href = "/" }: LogoProps) {
  // Aspect ratio approx 4.5:1 (width / 4.5 for height)
  // For an SVG, it's often better to let the SVG scale naturally if height is not explicitly constrained by parent,
  // but for next/image, providing both is good for layout shift prevention.
  const aspectRatio = 4.5; 
  const height = Math.round(width / aspectRatio);

  return (
    <Link href={href} className={cn("flex items-center text-foreground hover:opacity-90 transition-opacity", className)}>
      <Image
        src={DBAITR_SVG_LOGO_URL}
        alt="dbaitr logo"
        width={width}
        height={height}
        priority // Good for LCP elements like a primary logo
      />
    </Link>
  );
}
