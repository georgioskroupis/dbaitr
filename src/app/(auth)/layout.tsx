import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center">
        {/* Use the new Logo component, it includes "db8" text */}
        <Logo iconSize={10} href="/" />
        <p className="mt-2 text-muted-foreground">AI Powered Debates</p>
      </div>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        {children}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} db8. All rights reserved.
      </p>
    </div>
  );
}
