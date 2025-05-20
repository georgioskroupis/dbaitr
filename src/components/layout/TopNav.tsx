
// src/components/layout/TopNav.tsx
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, useEffect, useCallback, useRef } from 'react';
import { Home, UserPlus, Loader2 } from 'lucide-react'; // Removed SearchIconLucide
import { cn, debounce, highlightSemanticMatches } from '@/lib/utils.tsx';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserNav } from './UserNav';
import { GavelHookIcon } from './GavelIcon'; // Changed to GavelIcon
import { useToast } from '@/hooks/use-toast';
import { getTopicByTitle } from '@/lib/firestoreActions';
import { getSemanticTopicSuggestions } from '@/app/actions/searchActions';
import type { FindSimilarTopicsOutput, SimilarTopicSuggestion } from '@/ai/flows/find-similar-topics';

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
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SimilarTopicSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchId = useRef<string|null>(null);

  const isLandingPage = variant === 'landing';
  const MIN_CHARS_FOR_SEARCH = 1;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (isLandingPage) return;
      if (!query.trim() || query.length < MIN_CHARS_FOR_SEARCH) {
        setSuggestions([]);
        setShowSuggestions(false);
        setIsSuggestionLoading(false);
        return;
      }

      const fetchId = Math.random().toString(36).slice(2);
      lastFetchId.current = fetchId;
      if (process.env.NODE_ENV !== "production") {
        console.log(`[TopNav-${fetchId}] -> fetching suggestions for "${query}"`);
      }
      setIsSuggestionLoading(true);
      
      try {
        const result = await getSemanticTopicSuggestions({ query });
        
        if (lastFetchId.current !== fetchId) {
          if (process.env.NODE_ENV !== "production") {
            console.log(`[TopNav-${fetchId}] Stale response for "${query}", ignoring.`);
          }
          return;
        }

        const uniqueSuggestions = Array.from(new Map(result.suggestions.map(s => [s.title, s])).values());

        if (process.env.NODE_ENV !== "production") {
            console.log(`[TopNav-${fetchId}] <- results for "${query}":`, uniqueSuggestions.map(s => s.title));
            console.log(`[TopNav-${fetchId}] Full result object for "${query}":`, JSON.stringify(result, null, 2));
        }
        setSuggestions(uniqueSuggestions);
        setShowSuggestions(uniqueSuggestions.length > 0);

      } catch (error) {
        console.error("TopNav: Failed to fetch suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        if (lastFetchId.current === fetchId) {
          setIsSuggestionLoading(false);
        }
      }
    }, 300),
    [isLandingPage]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveSuggestionIndex(-1);
    if (isLandingPage) return;

    if (!query.trim() || query.length < MIN_CHARS_FOR_SEARCH) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestionLoading(false);
    } else {
      debouncedFetchSuggestions(query);
    }
  };

  const handleSuggestionClick = async (title: string) => {
    if (isLandingPage) return;
    setIsSearching(true);
    setSearchQuery(title);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    try {
      const topic = await getTopicByTitle(title);
      if (topic?.id) {
        router.push(`/topics/${topic.id}`);
      } else {
        router.push(`/topics/new?title=${encodeURIComponent(title)}`);
      }
      setSearchQuery('');
    } catch (error) {
      toast({ title: "Navigation Error", description: "Could not navigate to suggested topic.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLandingPage || !searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
     if (exactMatchInCurrentSuggestions && activeSuggestionIndex === -1) {
        await handleSuggestionClick(exactMatchInCurrentSuggestions.title);
        return;
    } else if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        await handleSuggestionClick(suggestions[activeSuggestionIndex].title);
        return;
    }
    
    try {
      const existingTopic = await getTopicByTitle(searchQuery.trim());
      if (existingTopic?.id) {
        toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
        router.push(`/topics/${existingTopic.id}`);
      } else {
        toast({ title: "Create New Topic", description: `Let's create "${searchQuery.trim()}".` });
        router.push(`/topics/new?title=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchQuery('');
    } catch (error: any) {
      toast({
        title: "Search Error",
        description: `An error occurred: ${error.message || "Could not perform search."}`,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLandingPage || !showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prevIndex) => (prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        handleSuggestionClick(suggestions[activeSuggestionIndex].title);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };
  
  useEffect(() => {
    if (isLandingPage) return;
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchContainerRef, isLandingPage]);


  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
  ];

  return (
    <header className={cn(
      isLandingPage
        ? "absolute top-0 left-0 w-full z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-foreground bg-transparent"
        : "sticky top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-foreground border-b border-border bg-background/70 backdrop-blur-md"
    )}>
      
      {!isLandingPage && (
        <div className="flex items-center gap-x-4">
          <Logo width={100} href="/" /> {/* dbaitr Logo */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
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
        </div>
      )}

      {!isLandingPage && (
        <div className="flex-1 hidden md:flex justify-center px-4">
          <div className="w-full max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative">
                <GavelHookIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" strokeWidth={2} /> 
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="What's the dbaitr?" 
                  value={searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => !isLandingPage && searchQuery.trim().length >= MIN_CHARS_FOR_SEARCH && suggestions.length > 0 && setShowSuggestions(true)}
                  className="h-9 w-full rounded-md border-border bg-input pl-9 pr-4 text-sm text-foreground placeholder-muted-foreground focus:ring-primary" 
                  disabled={isSearching}
                  autoComplete="off"
                />
              </div>
               {showSuggestions && !isLandingPage && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto text-left">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.title + index}
                      className={cn(
                        "p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0", 
                        index === activeSuggestionIndex && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSuggestionClick(suggestion.title)}
                       onMouseDown={(e) => e.preventDefault()}
                    >
                      <p className="font-medium text-xs text-foreground truncate">
                        {highlightSemanticMatches(suggestion.title, suggestion.matches || (suggestion.matchedPhrase ? [suggestion.matchedPhrase] : []))}
                      </p>
                      <p className="text-xs text-muted-foreground">{(suggestion.score * 100).toFixed(0)}% match</p>
                    </div>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      
      {isLandingPage && (
         <nav className="flex flex-1 items-center justify-between w-full">
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
            
            <div className="flex items-center gap-2">
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : user ? (
                <UserNav />
              ) : (
                <Button asChild size="sm" variant="outline" className="border-primary/70 text-primary hover:bg-primary/20 hover:text-primary hover:border-primary">
                  <Link href="/auth">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Join dbaitr 
                  </Link>
                </Button>
              )}
            </div>
         </nav>
      )}

      {!isLandingPage && (
        <div className="flex items-center gap-2">
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : user ? (
            <UserNav />
          ) : (
            <Button asChild size="sm" variant="outline" className="border-primary/70 text-primary hover:bg-primary/20 hover:text-primary hover:border-primary">
              <Link href="/auth">
                <UserPlus className="mr-1.5 h-4 w-4" /> Join dbaitr 
              </Link>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
