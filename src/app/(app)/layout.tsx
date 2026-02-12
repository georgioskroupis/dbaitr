
// src/app/(app)/layout.tsx
"use client";

import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, UserPlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TopNav } from '@/components/layout/TopNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
import { SearchBottomSheet } from '@/components/search/SearchBottomSheet';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { BrandTooltip } from '@/components/branding/BrandTooltip';
import { UserNav } from '@/components/layout/UserNav';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isSuspended, kycVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Allow read-only access for unverified/suspended users; no automatic redirects here.

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground/80">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading your dbaitr experience...</p>
      </div>
    );
  }
  
  const showSuspensionBanner = isSuspended && pathname !== '/account-suspended' && pathname !== '/verify-identity';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopNav variant="default" />
      
      <main className={cn(
        "flex-1 w-full mx-auto",
        isMobile ? "pb-16" : "pt-0",
        "p-4 md:p-6 lg:p-8"
      )}>
        {/* Logo now lives in TopNav; no duplicate on mobile */}
        {showSuspensionBanner && (
          <Alert variant="destructive" className="mb-6 relative z-20">
            <AlertTitle className="font-semibold">Account Access Restricted</AlertTitle>
            <AlertDescription>
              Your personhood verification is overdue. Please complete it to restore full access.
              <Button variant="link" asChild className="p-0 ml-2 text-primary hover:text-primary/80 underline">
                <Link href="/verify-identity">Verify Personhood Now</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>

      {isMobile && <BottomNav setSearchModalOpen={setIsSearchModalOpen} />} 
      {isMobile ? (
        <SearchBottomSheet open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
      ) : (
        <GlobalSearchModal isOpen={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
      )}

      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm">
        © {new Date().getFullYear()} <BrandTooltip><span className="underline decoration-transparent hover:decoration-primary/50 decoration-2 underline-offset-2 cursor-help">dbaitr</span></BrandTooltip> - /dɪˈbeɪ.tər/: where debate meets de-bait
      </footer>
      <Toaster />
    </div>
  );
}
