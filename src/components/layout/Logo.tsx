// src/components/layout/Logo.tsx
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { GavelHookIcon } from './GavelIcon'; // Corrected import path

interface LogoProps {
  className?: string;
  width?: number;
  href?: string;
}

// Placeholder for the main "dbai[gavel-hook]r" logo asset if it's a single image.
// If it's text + icon, we render it below.
// const DBAITR_TEXT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-text-logo.png?alt=media";

export function Logo({ className, width = 120, href = "/" }: LogoProps) {
  // For "dbai[gavel-hook]r" textual logo
  const iconSize = width ? width * 0.2 : 24; // Adjust icon size relative to text

  return (
    <Link href={href} className={cn("flex items-center gap-1 text-foreground hover:opacity-90 transition-opacity", className)} style={{ fontSize: `${width / 5}px` /* Approximate scaling */ }}>
      <span className="font-bold" style={{letterSpacing: '-0.05em'}}>dbai</span>
      <GavelHookIcon className="inline-block text-primary" style={{ width: `${iconSize}px`, height: `${iconSize}px`, transform: 'translateY(-0.05em)' }} />
      <span className="font-bold" style={{letterSpacing: '-0.05em'}}>r</span>
    </Link>
  );
}
