import Link from 'next/link';

interface LogoProps {
  className?: string;
  iconSize?: number; // Interpreted as height for the SVG container
  href?: string;
}

export function Logo({ className, iconSize = 8, href = "/dashboard" }: LogoProps) {
  // The SVG's viewBox will determine its aspect ratio.
  // Tailwind's h-${iconSize} will set the height, and w-auto will adjust width.
  const heightClass = `h-${iconSize}`;

  return (
    <Link href={href} className={`flex items-center gap-2 text-primary hover:text-primary/90 ${className}`}>
      <svg
        viewBox="0 0 135 40" // Adjusted viewBox for better layout
        xmlns="http://www.w3.org/2000/svg"
        className={`${heightClass} w-auto`}
        aria-label="db8 Logo"
      >
        {/* Speech bubble - Red */}
        <path
          d="M2 3H32C33.1046 3 34 3.89543 34 5V23C34 24.1046 33.1046 25 32 25H18L14 30V25H4C2.89543 25 2 24.1046 2 23V5C2 3.89543 2.89543 3 2 3Z"
          fill="hsl(var(--primary))"
        />
        {/* db8 text - White/Foreground color */}
        <text
          x="42" // Positioned after the bubble
          y="29" // Vertically centered relative to the bubble
          fontFamily="var(--font-poppins), Poppins, Helvetica Neue, Arial, sans-serif" // Use Poppins
          fontSize="28" // Scalable font size within SVG
          fontWeight="700" // Bold
          fill="hsl(var(--foreground))"
        >
          db8
        </text>
      </svg>
    </Link>
  );
}
