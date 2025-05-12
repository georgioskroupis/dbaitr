import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  width?: number; // Pixel width for the logo
  href?: string;
}

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-logo.png?alt=media&token=ccea3f69-32c3-4960-9b5f-afa56e963347";

export function Logo({ className, width = 160, href = "/dashboard" }: LogoProps) {
  // Assuming the logo db8-logo.png is square. Height will be equal to width.
  // For the given logo, it's not square, so we need to calculate height based on aspect ratio or set a fixed height.
  // Let's assume an approximate aspect ratio or set a reasonable height.
  // For db8-logo.png, if width is 160, a height around 40-50px might be appropriate.
  // Let's set a fixed height for simplicity, or calculate based on a known aspect ratio.
  // If the original logo is 500x125px (example), aspect ratio is 4:1. So height = width / 4.
  // Given the db8-logo.png, a width of 160px would likely have a height around 40px.
  // For next/image, it's better if we know the actual dimensions or it will fetch them.
  // Let's assume a height that looks good for a 160px wide logo.
  const height = width / 4; // Example: if logo is 1000x250

  return (
    <Link href={href} className={cn("flex items-center gap-2 text-primary hover:text-primary/90", className)}>
      <Image
        src={LOGO_URL}
        alt="db8 logo"
        width={width}
        height={height} // Adjust if aspect ratio is known or use 0 for auto-height with fill/responsive
        priority //  Load the logo quickly, especially if it's LCP
        // If the image is not inherently responsive or aspect ratio is tricky, consider objectFit
        // style={{ objectFit: 'contain' }} 
      />
    </Link>
  );
}

