// src/components/layout/Logo.tsx
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width?: number; 
  href?: string; // href is now explicitly used
}

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-logo.png?alt=media&token=ccea3f69-32c3-4960-9b5f-afa56e963347";

export function Logo({ className, width = 120, href = "/" }: LogoProps) { // Default width adjusted
  const aspectRatio = 4; // Assuming logo is roughly 4:1 (e.g. 1000x250). Adjust if different.
  const height = width / aspectRatio;

  return (
    <Link href={href} className={cn("flex items-center gap-2 text-primary hover:opacity-90 transition-opacity", className)}>
      <Image
        src={LOGO_URL}
        alt="db8 logo"
        width={width}
        height={height} 
        priority 
        // Consider adding style={{ objectFit: 'contain' }} if aspect ratio issues persist with various widths
      />
    </Link>
  );
}
