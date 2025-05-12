import { Landmark } from 'lucide-react'; // Changed from BotMessageSquare
import Link from 'next/link';

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
  showText?: boolean;
}

export function Logo({ className, iconSize = 8, textSize = "text-2xl", showText = true }: LogoProps) {
  return (
    <Link href="/dashboard" className={`flex items-center gap-2 text-primary hover:text-primary/90 ${className}`}>
      <Landmark className={`h-${iconSize} w-${iconSize}`} /> {/* Changed icon */}
      {showText && <span className={`font-bold ${textSize}`}>db8</span>} {/* Changed text */}
    </Link>
  );
}
