import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { TopNav } from '@/components/layout/TopNav';
import { BrandTooltip } from '@/components/branding/BrandTooltip';
import { cn } from '@/lib/utils';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(
        "auth-layout relative min-h-screen flex flex-col items-center p-4 pt-24 md:pt-28",
      )}>
      <TopNav variant="landing" />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        {children}
      </div>
      <p className="relative z-10 mt-8 text-center text-sm text-foreground font-light"> {/* Changed text-muted-foreground to text-foreground */}
        &copy; {new Date().getFullYear()} <BrandTooltip><span className="underline decoration-transparent hover:decoration-primary/50 decoration-2 underline-offset-2 cursor-help">dbaitr</span></BrandTooltip>. All rights reserved.
      </p>
    </div>
  );
}
