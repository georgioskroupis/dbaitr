import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width?: number; // Pixel width for the logo
  href?: string;
}

export function Logo({ className, width = 120, href = "/dashboard" }: LogoProps) {
  // Assuming the logo db8-logo.png is square. Height will be equal to width.
  const height = width;

  return (
    <Link href={href} className={cn("flex items-center gap-2 text-primary hover:text-primary/90", className)}>
      <Image
        src="/assets/images/db8-logo.png" // Path to the logo in the public folder
        alt="db8 Logo"
        width={width}
        height={height}
        priority //  Load the logo quickly, especially if it's LCP
      />
    </Link>
  );
}
