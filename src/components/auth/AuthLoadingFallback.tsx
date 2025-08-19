"use client";

import { Loader2 } from 'lucide-react';

export function AuthLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-white/80">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p>Loading authentication...</p>
    </div>
  );
}

