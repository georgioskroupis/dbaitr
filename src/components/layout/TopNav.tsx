
// src/components/layout/TopNav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandTooltip } from '@/components/branding/BrandTooltip';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { UserNav } from './UserNav';
import { SearchBar } from '@/components/search/SearchBar';
import { useIsMobile } from '@/hooks/use-mobile';

interface TopNavProps {
  variant?: 'default' | 'landing';
}

export function TopNav({ variant = 'default' }: TopNavProps) {
  const pathname = usePathname();
  const { user, userProfile, loading: authLoading } = useAuth();
  const isLandingPage = variant === 'landing';
  const isMobile = useIsMobile();


  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/manifesto', label: 'Manifesto', icon: Home },
    { href: '/pricing', label: 'Pricing', icon: Home },
  ];

  const RightCluster = () => (
    <div className="flex items-center gap-2">
      {(!isMobile || isLandingPage) && (
        <nav className={cn(isLandingPage ? 'flex' : 'hidden md:flex', 'items-center gap-1 sm:gap-2')}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === item.href || (item.href === "/dashboard" && pathname.startsWith("/topics"))
                  ? "bg-primary/20 text-primary"
                  : "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {authLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : user ? (
        <UserNav includeMobileExtras={isMobile && !isLandingPage} />
      ) : (
        <Button asChild size="sm" variant="outline" className="border-primary/70 text-primary hover:bg-primary/20 hover:text-primary hover:border-primary">
          <Link href="/auth">
            <UserPlus className="mr-1.5 h-4 w-4" /> Be a <BrandTooltip side="bottom" avoidCollisions collisionPadding={12}><span className="cursor-help inline align-baseline">dbaitr</span></BrandTooltip>
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <header className={cn(
      isLandingPage
        ? "absolute top-0 left-0 w-full z-40 flex h-16 items-center justify-end gap-4 px-4 md:px-6 text-foreground bg-transparent"
        : "sticky top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-foreground border-b border-border bg-background/70 backdrop-blur-md"
    )}>
      {!isLandingPage && (
        <div className="flex items-center h-full gap-x-4 flex-1 min-w-0">
          <Logo width={90} ratio={35/17} href="/" />
          <div className="hidden md:flex ml-4 w-full max-w-lg lg:max-w-xl">
            <SearchBar size="compact" placeholder="What's the debate?" />
          </div>
        </div>
      )}
      <RightCluster />
    </header>
  );
}
