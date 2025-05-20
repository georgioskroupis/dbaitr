
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
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TopNav } from '@/components/layout/TopNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isSuspended, kycVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (isSuspended) {
        if (pathname !== '/verify-identity' && pathname !== '/account-suspended') {
          router.replace('/account-suspended');
        }
      } else if (user && !kycVerified && pathname === '/account-suspended') {
        router.replace('/verify-identity');
      } else if (user && kycVerified && pathname === '/account-suspended') {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, isSuspended, kycVerified, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground/80"> {/* Theme colors */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" /> {/* Use primary color */}
        <p className="mt-4 text-lg">Loading your dbaitr experience...</p> {/* Changed from db8 */}
      </div>
    );
  }
  
  const showSuspensionBanner = isSuspended && pathname !== '/account-suspended' && pathname !== '/verify-identity';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground"> {/* Theme colors */}
      {!isMobile && <TopNav variant="default" />}
      
      <main className={cn(
        "flex-1 w-full mx-auto",
        isMobile ? "pb-16" : "pt-0",
        "p-4 md:p-6 lg:p-8"
      )}>
        {isMobile && (
          <div className="px-0 pb-4 md:hidden">
            <Logo width={90} /> {/* dbaitr Logo */}
          </div>
        )}
        {showSuspensionBanner && (
          <Alert variant="destructive" className="mb-6"> {/* Destructive styling is now from theme */}
            <AlertTitle className="font-semibold">Account Access Restricted</AlertTitle>
            <AlertDescription>
              Your identity verification is overdue. Please complete it to restore full access.
              <Button variant="link" asChild className="p-0 ml-2 text-primary hover:text-primary/80 underline"> {/* Use primary color for link */}
                <Link href="/verify-identity">Verify Identity Now</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>

      {isMobile && <BottomNav setSearchModalOpen={setIsSearchModalOpen} />}
      <GlobalSearchModal isOpen={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />

      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur-sm"> {/* Theme colors */}
        © {new Date().getFullYear()} dbaitr - AI Powered Debates {/* Changed from db8 */}
      </footer>
      <Toaster />
    </div>
  );
}
