// src/components/layout/BottomNav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, UserPlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { GavelHookIcon as GavelIcon } from './GavelIcon'; // Changed to GavelHookIcon and aliased
import type { Dispatch, SetStateAction } from 'react';

interface BottomNavProps {
  setSearchModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function BottomNav({ setSearchModalOpen }: BottomNavProps) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard', id: 'dashboard' },
    { 
      action: () => setSearchModalOpen(true), 
      icon: GavelIcon, 
      label: 'Start dbaitr', // Changed from db8
      id: 'start-dbaitr' 
    },
    { 
      href: user ? '/profile' : '/auth', 
      icon: user ? User : UserPlus, 
      label: user ? 'Profile' : 'Join dbaitr', // Changed from db8
      id: user ? 'profile' : 'join-dbaitr', // Changed from db8
      authRequired: false 
    },
  ];

  if (loading) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-border bg-background/80 backdrop-blur-md md:hidden"> {/* Theme colors */}
        <div className="flex h-full items-center justify-around">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20"></div> {/* Theme colors */}
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20"></div> {/* Theme colors */}
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20"></div> {/* Theme colors */}
        </div>
      </div>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-border bg-background/80 backdrop-blur-md md:hidden"> {/* Theme colors */}
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const isActive = item.href ? pathname === item.href || (item.href === "/dashboard" && pathname.startsWith("/topics")) : false;
          const Icon = item.icon;
          
          const itemKey = item.href || item.id;
          
          let buttonSpecificClasses = '';
          if (item.id === 'start-dbaitr') { // Changed from start-db8
            buttonSpecificClasses = 'bg-primary/20 hover:bg-primary/30 p-3 rounded-lg'; 
          } else {
            buttonSpecificClasses = 'p-2';
          }

          const commonProps = {
            className: cn(
              'flex flex-col items-center justify-center gap-1 rounded-md text-xs transition-colors',
              isActive ? 'text-primary' : 'text-foreground/70 hover:text-foreground hover:bg-accent/10', // Theme colors
              buttonSpecificClasses
            ),
          };
          

          if (item.action) {
            return (
              <button key={itemKey} {...commonProps} onClick={item.action} aria-label={item.label}>
                <Icon className={cn("h-6 w-6", item.id === 'start-dbaitr' ? "text-white" : "")} /> {/* Gavel icon is white */}
              </button>
            );
          }

          return (
            <Link key={itemKey} href={item.href!} {...commonProps} aria-label={item.label}>
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
