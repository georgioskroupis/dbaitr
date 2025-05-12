import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(
        "auth-background-glow flex min-h-screen flex-col items-center justify-center p-4",
        // Ensure content is above the pseudo-element glows if necessary by making children part of a new stacking context
        // However, typically direct children of a flex container don't need explicit z-indexing for this.
        // If card/logo appears behind glows, add `relative z-10` to child containers.
      )}>
      <div className="relative z-10 mb-8 flex flex-col items-center"> {/* Added relative z-10 */}
        <Logo width={160} href="/" />
        {/* Subtitle "AI Powered Debates" removed as per request */}
      </div>
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl"> {/* Added relative z-10 */}
        {children}
      </div>
      <p className="relative z-10 mt-8 text-center text-sm text-muted-foreground font-light"> {/* Added relative z-10 and font-light */}
        &copy; {new Date().getFullYear()} db8. All rights reserved.
      </p>
    </div>
  );
}
