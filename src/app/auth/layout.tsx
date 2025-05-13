
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(
        "auth-layout flex min-h-screen flex-col items-center justify-center p-4", 
      )}>
      <div className="relative z-10 mb-8 flex flex-col items-center">
        <Logo width={160} href="/" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        {children}
      </div>
      <p className="relative z-10 mt-8 text-center text-sm text-foreground font-light footer-text">
        &copy; {new Date().getFullYear()} db8. All rights reserved.
      </p>
    </div>
  );
}
