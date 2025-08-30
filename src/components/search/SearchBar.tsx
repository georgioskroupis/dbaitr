"use client";

import { useState, type FormEvent, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { highlightSemanticMatches } from '@/lib/react-utils';
import { useSemanticSuggestions } from '@/hooks/useSemanticSuggestions';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { getDb } from '@/lib/firebase/client';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

type Size = 'default' | 'compact';

interface SearchBarProps {
  size?: Size;
  placeholder?: string;
  disabledSuggestions?: boolean;
  className?: string;
  suggestionsPlacement?: 'down' | 'up';
}

const FAVICON_SVG_URL = "/dbaitr-favicon.svg";

export function SearchBar({
  size = 'default',
  placeholder,
  disabledSuggestions = false,
  className,
  suggestionsPlacement = 'down',
}: SearchBarProps) {
  const db = getDb();
  const isCompact = size === 'compact';
  const MIN_CHARS = 3;
  const router = useRouter();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { suggestions, loading: isSuggestionLoading, debouncedFetchSuggestions, clear } = useSemanticSuggestions({ minChars: MIN_CHARS, debounceMs: 300, disabled: disabledSuggestions });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Show dropdown from first keystroke; content varies by state/length
    const hasAny = searchQuery.trim().length >= 1;
    setShowSuggestions(hasAny);
  }, [suggestions, isSuggestionLoading, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveSuggestionIndex(-1);
    if (!query.trim()) {
      clear();
      setShowSuggestions(false);
    } else if (query.length < MIN_CHARS) {
      // Below threshold: clear prior suggestions and show guidance
      clear();
      setShowSuggestions(true);
    } else {
      // Immediately show dropdown with spinner while fetching
      setShowSuggestions(true);
      debouncedFetchSuggestions(query);
    }
  };

  const handleSuggestionClick = async (title: string) => {
    setIsLoading(true);
    setSearchQuery(title);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    try {
      async function getTopicByTitle(t: string) {
        const q = query(collection(db, 'topics'), where('title', '==', t), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { id: d.id, ...(d.data() as any) };
      }
      const topic = await getTopicByTitle(title);
      if (topic?.id) {
        router.push(`/topics/${topic.id}`);
      } else {
        router.push(`/topics/new?title=${encodeURIComponent(title)}`);
      }
    } catch (error) {
      logger.error("[SearchBar] Navigation error:", error);
      toast({ title: "Navigation Error", description: "Could not navigate to the selected topic.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prevIndex) =>
        prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
      );
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

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: "Empty Search", description: "Please enter a topic to search or create.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactMatchInCurrentSuggestions && activeSuggestionIndex === -1) {
      await handleSuggestionClick(exactMatchInCurrentSuggestions.title);
      return;
    }

    try {
      async function getTopicByTitle(t: string) {
        const q = query(collection(db, 'topics'), where('title', '==', t), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { id: d.id, ...(d.data() as any) };
      }
      const existingTopic = await getTopicByTitle(searchQuery.trim());
      if (existingTopic?.id) {
        toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
        router.push(`/topics/${existingTopic.id}`);
      } else {
        toast({ title: "Create New Topic", description: `Let's create "${searchQuery.trim()}".` });
        router.push(`/topics/new?title=${encodeURIComponent(searchQuery.trim())}`);
      }
    } catch (error: any) {
      logger.error("[SearchBar] Error during topic search or create:", error);
      toast({ title: "Search Error", description: error.message || 'Unknown error.', variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
  }, []);

  const inputHeight = isCompact ? 'h-9' : 'h-12';
  const inputText = isCompact ? 'text-sm placeholder:text-sm' : 'text-base md:text-lg lg:text-xl placeholder:text-base md:placeholder:text-lg lg:placeholder:text-xl';
  const inputPadding = isCompact ? 'pl-10 pr-10' : 'pl-12 pr-12';
  const buttonSize = isCompact ? 'h-8 w-8' : 'h-9 w-9';
  const iconSize = isCompact ? 'h-5 w-5' : 'h-7 w-7';

  return (
    <form onSubmit={handleSearchSubmit} className={cn("w-full space-y-0", className)}>
      <div className="relative" ref={searchContainerRef}>
        <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 -mt-0.5 z-10 pointer-events-none", iconSize)}>
          <img
            src={FAVICON_SVG_URL}
            alt="dbaitr icon"
            className="h-full w-full animate-gavel-strike-paused origin-bottom invert brightness-0"
            width={isCompact ? 20 : 24}
            height={isCompact ? 20 : 24}
          />
        </span>
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery.trim().length >= 1 && setShowSuggestions(true)}
          placeholder={placeholder ?? "What's the debate?"}
          className={cn(
            "w-full rounded-md border border-input bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur-md transition",
            inputHeight,
            inputText,
            inputPadding
          )}
          disabled={isLoading}
          aria-label="Search debate topic"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isLoading || !searchQuery.trim()}
          aria-label="Search or Create Topic"
          className={cn("absolute right-[0.38rem] top-1/2 -translate-y-1/2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-md flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition", buttonSize)}
        >
          {isLoading && !isSuggestionLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MessageSquare className={cn(isCompact ? 'h-5 w-5' : 'h-6 w-6')} />
          )}
        </button>

        {showSuggestions && searchQuery.trim().length >= MIN_CHARS && suggestions.length === 0 && isSuggestionLoading && (
          <div
            className={cn(
              "absolute left-0 right-0 w-full bg-card border border-border rounded-md shadow-lg z-20 overflow-y-auto text-left",
              suggestionsPlacement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
            )}
          >
            <div className="flex items-center gap-2 p-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className={cn(isCompact ? 'text-xs' : 'text-sm')}>Searching…</span>
            </div>
          </div>
        )}

        {showSuggestions && suggestions.length === 0 && !isSuggestionLoading && (
          <div
            className={cn(
              "absolute left-0 right-0 w-full bg-card border border-border rounded-md shadow-lg z-20 text-left",
              suggestionsPlacement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
            )}
          >
            {searchQuery.trim().length < MIN_CHARS ? (
              <div className={cn("p-3 text-muted-foreground flex items-center gap-0.5", isCompact ? 'text-xs' : 'text-sm')}>
                <span>Keep typing</span>
                <span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
                <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
              </div>
            ) : (
              <div className={cn("p-3 text-muted-foreground", isCompact ? 'text-xs' : 'text-sm')}>No suggestions yet</div>
            )}
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div
            className={cn(
              "absolute left-0 right-0 w-full bg-card border border-border rounded-md shadow-lg z-20 overflow-y-auto text-left",
              suggestionsPlacement === 'down' ? 'top-full mt-1 max-h-60' : 'bottom-full mb-1 max-h-[40vh]'
            )}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.title + index}
                className={cn(
                  "suggestion-item p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border last:border-b-0",
                  index === activeSuggestionIndex && "bg-accent text-accent-foreground is-active"
                )}
                onClick={() => handleSuggestionClick(suggestion.title)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <p className={cn("font-medium text-foreground", isCompact ? 'text-xs' : 'text-sm')}>
                  {highlightSemanticMatches(suggestion.title, suggestion.matches)}
                </p>
                <p className="text-xs text-muted-foreground">Similarity: {(suggestion.score * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
