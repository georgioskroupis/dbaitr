import { BotMessageSquare } from 'lucide-react';
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
      <BotMessageSquare className={`h-${iconSize} w-${iconSize}`} />
      {showText && <span className={`font-bold ${textSize}`}>ArguMate</span>}
    </Link>
  );
}
