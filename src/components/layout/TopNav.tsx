
// src/components/layout/TopNav.tsx
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, useEffect } from 'react';
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

  useEffect(() => {
    async function fetchTopics() {
      try {
        const titles = await getAllTopicTitles();
        setExistingTopicTitles(titles);
      } catch (error) {
        console.error("TopNav: Failed to load existing topic titles:", error);
        // Non-critical, search will still work but without pre-check
      }
    }
    if (variant === 'default') { // Only fetch for default variant search bar
        fetchTopics();
    }
  }, [variant]);

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
        description: `An error occurred during the search process. This could be due to a network issue or a problem with the AI topic analysis service. Please try again. Error details: ${error.message || "Could not perform search."}`,
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
      isLandingPage
        ? "absolute top-0 left-0 w-full z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-white bg-transparent"
        : "sticky top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-white border-b border-white/10 bg-black/70 backdrop-blur-md"
    )}>
      
      {/* Left Section: Logo and Dashboard link for default variant */}
      {!isLandingPage && (
        <div className="flex items-center gap-x-4">
          <Logo width={100} href="/" />
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
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
        </div>
      )}

      {/* Center Section: Search bar for default variant (Desktop) */}
      {!isLandingPage && (
        <div className="flex-1 hidden md:flex justify-center px-4">
          <div className="w-full max-w-xs lg:max-w-sm xl:max-w-md">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative">
                <GavelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" /> {/* Gavel icon color updated */}
                <Input
                  type="search"
                  placeholder="What's the db8?" // Placeholder text updated
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-md border-white/20 bg-white/5 pl-9 pr-2 text-sm text-white placeholder-white/60 focus:ring-rose-500"
                  disabled={isSearching}
                />
                {isSearching && <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />}
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Landing page specific nav items layout */}
      {isLandingPage && (
         <nav className="flex flex-1 items-center justify-between w-full">
            {/* Dashboard link to the far left */}
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
            
            {/* Auth related button to the far right */}
            <div className="flex items-center gap-2">
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
              ) : user ? (
                <UserNav />
              ) : (
                <Button asChild size="sm" variant="outline" className="border-rose-500/70 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500">
                  <Link href="/auth">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Join the db8
                  </Link>
                </Button>
              )}
            </div>
         </nav>
      )}


      {/* Right Section: Auth section for default variant (Desktop) */}
      {!isLandingPage && (
        <div className="flex items-center gap-2">
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-rose-400" />
          ) : user ? (
            <UserNav />
          ) : (
            <Button asChild size="sm" variant="outline" className="border-rose-500/70 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500">
              <Link href="/auth">
                <UserPlus className="mr-1.5 h-4 w-4" /> Join the db8
              </Link>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
