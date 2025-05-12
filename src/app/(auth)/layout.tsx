import type { ReactNode } from 'react';
import Link from 'next/link';
import { BotMessageSquare } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90">
          <BotMessageSquare className="h-10 w-10" />
          <h1 className="text-4xl font-bold">ArguMate</h1>
        </Link>
        <p className="mt-2 text-muted-foreground">AI Powered Debates</p>
      </div>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        {children}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} ArguMate. All rights reserved.
      </p>
    </div>
  );
}
