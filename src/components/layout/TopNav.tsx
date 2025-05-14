// src/components/layout/TopNav.tsx
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Home, User, UserPlus, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserNav } from './UserNav';
import { GavelIcon } from './GavelIcon';
import { useToast } from '@/hooks/use-toast';
import { findSimilarTopics } from '@/ai/flows/find-similar-topics';
import { getAllTopicTitles, getTopicByTitle } from '@/lib/firestoreActions';


interface TopNavProps {
  variant?: 'default' | 'landing';
}

export function TopNav({ variant = 'default' }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [existingTopicTitles, setExistingTopicTitles] = useState<string[]>([]);

  // Fetch topic titles for search suggestion/check (can be optimized)
  useState(() => {
    async function fetchTopics() {
      try {
        const titles = await getAllTopicTitles();
        setExistingTopicTitles(titles);
      } catch (error) {
        console.error("TopNav: Failed to load existing topic titles:", error);
        // Non-critical, search will still work but without pre-check
      }
    }
    fetchTopics();
  }, []);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: "Empty Search", description: "Please enter a topic.", variant: "destructive" });
      return;
    }
    setIsSearching(true);
    try {
      const similarTopicsResult = await findSimilarTopics({
        newTopic: searchQuery,
        existingTopics: existingTopicTitles,
      });

      if (similarTopicsResult.isSimilar && similarTopicsResult.closestMatch) {
        const existingTopic = await getTopicByTitle(similarTopicsResult.closestMatch);
        if (existingTopic?.id) {
          toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
          router.push(`/topics/${existingTopic.id}`);
          setSearchQuery(''); // Clear search
          return;
        }
      }
      toast({ title: "Create New Topic", description: `Let's create "${searchQuery}".` });
      router.push(`/topics/new?title=${encodeURIComponent(searchQuery)}`);
      setSearchQuery(''); // Clear search
    } catch (error: any) {
      toast({
        title: "Search Error",
        description: error.message || "Could not perform search.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
  ];

  const isLandingPage = variant === 'landing';

  return (
    <header className={cn(
      "sticky top-0 z-40 flex h-16 items-center gap-4 border-b px-4 md:px-6",
      "border-white/10 bg-black/70 backdrop-blur-md text-white"
    )}>
      <div className={cn(
        "flex items-center",
        isLandingPage ? "flex-1 justify-center" : "justify-start" 
      )}>
        <Logo width={isLandingPage ? 120 : 100} href="/" />
      </div>

      {!isLandingPage && (
        <nav className="hidden flex-1 justify-center items-center gap-1 sm:gap-2 md:gap-4 lg:gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === item.href || (item.href === "/dashboard" && pathname.startsWith("/topics"))
                  ? "bg-rose-500/30 text-rose-300"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      
      {/* Landing page specific nav items */}
      {isLandingPage && (
         <nav className="hidden md:flex flex-1 items-center justify-start gap-6 pl-8">
            <Link
              href="/dashboard"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                 pathname === "/dashboard" || pathname.startsWith("/topics")
                  ? "bg-rose-500/30 text-rose-300"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              Dashboard
            </Link>
         </nav>
      )}


      {!isLandingPage && (
        <div className="hidden md:flex items-center justify-center flex-1 max-w-xs lg:max-w-sm xl:max-w-md">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative">
              <GavelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-400" />
              <Input
                type="search"
                placeholder="Start a db8..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border-white/20 bg-white/5 pl-9 pr-2 text-sm text-white placeholder-white/60 focus:ring-rose-500"
                disabled={isSearching}
              />
              {isSearching && <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />}
            </div>
          </form>
        </div>
      )}


      <div className={cn(
        "flex items-center gap-2",
        isLandingPage ? "flex-1 justify-end" : ""
      )}>
        {authLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
        ) : user ? (
          <UserNav />
        ) : (
          <Button asChild size="sm" variant="outline" className="border-rose-500/70 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500">
            <Link href="/auth">
              <UserPlus className="mr-1.5 h-4 w-4" /> Join db8
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
