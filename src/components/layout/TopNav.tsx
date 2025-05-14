// src/components/layout/TopNav.tsx
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, useEffect, useCallback, useRef } from 'react';
import { Home, User, UserPlus, Search as SearchIconLucide, Loader2 } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserNav } from './UserNav';
import { GavelIcon } from './GavelIcon';
import { useToast } from '@/hooks/use-toast';
import { getTopicByTitle } from '@/lib/firestoreActions';
import { getSemanticTopicSuggestions } from '@/app/actions/searchActions';
import type { FindSimilarTopicsOutput } from '@/ai/flows/find-similar-topics';

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
  const [suggestions, setSuggestions] = useState<FindSimilarTopicsOutput['suggestions']>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setIsSuggestionLoading(true);
      try {
        const result = await getSemanticTopicSuggestions({ query });
         if (process.env.NODE_ENV !== "production") {
            console.log('TopNav suggestions results:', result.suggestions, 'for query:', query);
        }
        if (result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("TopNav: Failed to fetch suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSuggestionLoading(false);
        if (process.env.NODE_ENV !== "production") {
            console.log('TopNav suggestions final state:', suggestions, 'showSuggestions is:', showSuggestions, 'isSuggestionLoading is:', isSuggestionLoading);
        }
      }
    }, 300),
    [isLandingPage, showSuggestions] 
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
    try {
      const topic = await getTopicByTitle(title);
      if (topic?.id) {
        router.push(`/topics/${topic.id}`);
      } else {
        router.push(`/topics/new?title=${encodeURIComponent(title)}`);
      }
    } catch (error) {
      toast({ title: "Navigation Error", description: "Could not navigate to suggested topic.", variant: "destructive" });
    } finally {
      setIsSearching(false);
      setSearchQuery(''); 
    }
  };

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLandingPage || !searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowSuggestions(false);

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
     if (exactMatchInCurrentSuggestions && activeSuggestionIndex === -1) {
        await handleSuggestionClick(exactMatchInCurrentSuggestions.title);
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

  const renderHighlightedTitle = (title: string, matchedPhrase?: string) => {
    if (!matchedPhrase || !title.toLowerCase().includes(matchedPhrase.toLowerCase())) {
      return title;
    }
    const parts = title.split(new RegExp(`(${matchedPhrase})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === matchedPhrase.toLowerCase() ? (
            <strong key={index} className="text-primary font-semibold">
              {part}
            </strong>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
  ];

  return (
    <header className={cn(
      isLandingPage
        ? "absolute top-0 left-0 w-full z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-white bg-transparent"
        : "sticky top-0 z-40 flex h-16 items-center justify-between gap-4 px-4 md:px-6 text-white border-b border-white/10 bg-black/70 backdrop-blur-md"
    )}>
      
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

      {!isLandingPage && (
        <div className="flex-1 hidden md:flex justify-center px-4">
          <div className="w-full max-w-xs lg:max-w-sm xl:max-w-md relative" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative">
                <GavelIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                <Input
                  ref={inputRef}
                  type="search"
                  placeholder="What's the db8?"
                  value={searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => !isLandingPage && searchQuery.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                  className="h-9 w-full rounded-md border-white/20 bg-white/5 pl-9 pr-10 text-sm text-white placeholder-white/60 focus:ring-rose-500"
                  disabled={isSearching}
                  autoComplete="off"
                />
                {(isSearching || isSuggestionLoading) && !isLandingPage && (
                  <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
                )}
              </div>
               {showSuggestions && !isLandingPage && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto text-left">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.title + index}
                      className={cn(
                        "p-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0",
                        index === activeSuggestionIndex && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSuggestionClick(suggestion.title)}
                       onMouseDown={(e) => e.preventDefault()}
                    >
                      <p className="font-medium text-xs text-foreground truncate">
                        {renderHighlightedTitle(suggestion.title, suggestion.matchedPhrase)}
                      </p>
                      <p className="text-xs text-muted-foreground">{(suggestion.score * 100).toFixed(0)}% match</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Removed the explicit "Loading suggestions..." div that was styled like a dropdown */}
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
                  ? "bg-rose-500/30 text-rose-300" 
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              Dashboard
            </Link>
            
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
