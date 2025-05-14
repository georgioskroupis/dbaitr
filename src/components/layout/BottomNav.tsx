// src/components/layout/BottomNav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, UserPlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { GavelIcon } from './GavelIcon'; // Reusing the GavelIcon
import type { Dispatch, SetStateAction } from 'react';

interface BottomNavProps {
  setSearchModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function BottomNav({ setSearchModalOpen }: BottomNavProps) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { 
      action: () => setSearchModalOpen(true), 
      icon: GavelIcon, // Using the GavelIcon component here
      label: 'Start db8', 
      id: 'start-db8' 
    },
    { 
      href: user ? '/profile' : '/auth', // Simplified: /profile route would need to be created
      icon: user ? User : UserPlus, 
      label: user ? 'Profile' : 'Join db8',
      authRequired: false // Icon changes based on auth state
    },
  ];

  if (loading) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-white/10 bg-black/80 backdrop-blur-md md:hidden">
        <div className="flex h-full items-center justify-around">
          <div className="h-6 w-6 animate-pulse rounded-full bg-white/20"></div>
          <div className="h-6 w-6 animate-pulse rounded-full bg-white/20"></div>
          <div className="h-6 w-6 animate-pulse rounded-full bg-white/20"></div>
        </div>
      </div>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-white/10 bg-black/80 backdrop-blur-md md:hidden">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const isActive = item.href ? pathname === item.href || (item.href === "/dashboard" && pathname.startsWith("/topics")) : false;
          const Icon = item.icon;
          
          const commonProps = {
            key: item.href || item.id,
            className: cn(
              'flex flex-col items-center justify-center gap-1 p-2 rounded-md text-xs transition-colors',
              isActive ? 'text-rose-400' : 'text-white/70 hover:text-white hover:bg-white/10',
            ),
          };

          if (item.action) {
            return (
              <button {...commonProps} onClick={item.action}>
                <Icon className={cn("h-6 w-6", item.label === "Start db8" ? "text-rose-500" : "")} />
                {/* No labels as per requirement */}
              </button>
            );
          }

          return (
            <Link href={item.href!} {...commonProps}>
              <Icon className="h-6 w-6" />
              {/* No labels as per requirement */}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
