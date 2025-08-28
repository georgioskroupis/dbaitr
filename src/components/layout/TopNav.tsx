
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

interface TopNavProps {
  variant?: 'default' | 'landing';
}

export function TopNav({ variant = 'default' }: TopNavProps) {
  const pathname = usePathname();
  const { user, userProfile, loading: authLoading } = useAuth();
  const isLandingPage = variant === 'landing';


  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/manifesto', label: 'Manifesto', icon: Home },
    { href: '/pricing', label: 'Pricing', icon: Home },
  ];

  return (
    <header className={cn(
      isLandingPage
        ? "absolute top-0 left-0 w-full z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-foreground bg-transparent"
        : "sticky top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-foreground border-b border-border bg-background/70 backdrop-blur-md"
    )}>
      
      {!isLandingPage && (
        <div className="flex items-center h-full gap-x-4 flex-1 min-w-0">
          <Logo width={90} ratio={35/17} href="/" />
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
          {/* SearchBar next to nav; moderate width on laptop */}
          <div className="hidden md:flex ml-4 w-full max-w-lg lg:max-w-xl">
            <SearchBar size="compact" placeholder="What's the debate?" />
          </div>
        </div>
      )}

      {/* Center searchbar removed; now displayed next to nav */}
      
      {isLandingPage && (
         <nav className="flex flex-1 items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                   pathname === "/dashboard" || pathname.startsWith("/topics")
                    ? "bg-primary/20 text-primary" 
                    : "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/manifesto"
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === "/manifesto"
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
                )}
              >
                Manifesto
              </Link>
              <Link
                href="/pricing"
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname === "/pricing"
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
                )}
              >
                Pricing
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : user ? (
                <div className="flex items-center">
                  <UserNav />
                  <span className="hidden sm:inline ml-2 text-sm text-foreground/90 max-w-[180px] truncate">{userProfile?.fullName || user.displayName || user.email}</span>
                </div>
              ) : (
                <Button asChild size="sm" variant="outline" className="border-primary/70 text-primary hover:bg-primary/20 hover:text-primary hover:border-primary">
                  <Link href="/auth">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Be a <BrandTooltip side="bottom" avoidCollisions collisionPadding={12}><span className="cursor-help inline align-baseline">dbaitr</span></BrandTooltip>
                  </Link>
                </Button>
              )}
            </div>
         </nav>
      )}

      {!isLandingPage && (
        <div className="flex items-center gap-3">
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : user ? (
            <div className="flex items-center">
              <UserNav />
              <span className="hidden sm:inline ml-2 text-sm text-foreground/90 max-w-[180px] truncate">{userProfile?.fullName || user.displayName || user.email}</span>
            </div>
          ) : (
                <Button asChild size="sm" variant="outline" className="border-primary/70 text-primary hover:bg-primary/20 hover:text-primary hover:border-primary">
                  <Link href="/auth">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Be a <BrandTooltip side="bottom" avoidCollisions collisionPadding={12}><span className="cursor-help inline align-baseline">dbaitr</span></BrandTooltip>
                  </Link>
                </Button>
          )}
        </div>
      )}
    </header>
  );
}
