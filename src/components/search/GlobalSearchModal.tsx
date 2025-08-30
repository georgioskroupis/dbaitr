
// src/components/search/GlobalSearchModal.tsx
"use client";

import { useState, type FormEvent, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search as SearchIconLucide, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
// Avoid server action imports in client code
import { getDb } from '@/lib/firebase/client';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { GavelHookIcon as GavelIcon } from '@/components/layout/GavelIcon'; // Corrected import
import { cn } from '@/lib/utils';
import { highlightSemanticMatches } from '@/lib/react-utils'; 
import { useSemanticSuggestions } from '@/hooks/useSemanticSuggestions';
import type { SimilarTopicSuggestion } from '@/ai/flows/find-similar-topics';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({ isOpen, onOpenChange }: GlobalSearchModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const MIN_CHARS = 3;
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false); 
  const { suggestions, loading: isSuggestionLoading, debouncedFetchSuggestions, clear } = useSemanticSuggestions({ minChars: MIN_CHARS, debounceMs: 300 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchId = useRef<string|null>(null);

  useEffect(() => {
    const hasAny = searchQuery.trim().length >= 1;
    setShowSuggestions(hasAny);
  }, [suggestions, isSuggestionLoading, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      clear();
      setShowSuggestions(false);
      setIsLoading(false);
      setActiveSuggestionIndex(-1);
    } else {
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100); 
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveSuggestionIndex(-1);
     if (!query.trim()) {
      clear();
      setShowSuggestions(false);
    } else if (query.length < MIN_CHARS) {
      clear();
      setShowSuggestions(true);
    } else {
      setShowSuggestions(true); // open immediately with spinner while loading
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
        const q = query(collection(getDb(), 'topics'), where('title', '==', t), limit(1));
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
      onOpenChange(false); 
    } catch (error) {
      logger.error("GlobalSearchModal: Navigation error:", error);
      toast({ title: "Navigation Error", description: "Could not navigate to suggested topic.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: "Empty Search", description: "Please enter a topic.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactMatchInCurrentSuggestions && activeSuggestionIndex === -1) { // Ensure no suggestion is actively selected by keyboard
        await handleSuggestionClick(exactMatchInCurrentSuggestions.title);
        return;
    } else if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) { // User selected via keyboard and pressed Enter
        await handleSuggestionClick(suggestions[activeSuggestionIndex].title);
        return;
    }
    
    try {
      async function getTopicByTitle(t: string) {
        const q = query(collection(getDb(), 'topics'), where('title', '==', t), limit(1));
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
      onOpenChange(false); 
    } catch (error: any) {
      logger.error("GlobalSearchModal: Error during topic search/create:", error);
      toast({
        title: "Search/Create Topic Error",
        description: `Something went wrong: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

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
      // Allow form submission via handleSearchSubmit if Enter is pressed without an active suggestion
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, searchContainerRef]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-card backdrop-blur-md border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-semibold text-primary">
            <GavelIcon className="h-6 w-6 mr-2 text-primary" /> Welcome, de-baiter. Truth deserves a worthy opponent.
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This is where click-bait dies, and real debate lives.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearchSubmit} className="space-y-4 pt-4">
          <div className="relative" ref={searchContainerRef}>
            <SearchIconLucide className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /> {/* text-white/60 to text-muted-foreground */}
            <Input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => searchQuery.trim().length >= 1 && setShowSuggestions(true)}
              placeholder="What's the debate?"
              className="w-full pl-10 pr-4 py-3 text-base rounded-lg border border-input bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur-md transition h-12"
              disabled={isLoading}
              aria-label="Search debate topic"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length === 0 && isSuggestionLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 text-left">
                  <div className="flex items-center justify-center gap-2 p-3 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching…</span>
                  </div>
                </div>
              )}
            {showSuggestions && suggestions.length === 0 && !isSuggestionLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 text-left">
                  {searchQuery.trim().length < MIN_CHARS ? (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-0.5">
                      <span>Keep typing</span>
                      <span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
                      <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No suggestions yet</div>
                  )}
                </div>
              )}
            {showSuggestions && searchQuery.trim().length >= MIN_CHARS && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto text-left">
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
                      <p className="font-medium text-sm text-foreground">
                         {highlightSemanticMatches(suggestion.title, suggestion.matches)}
                      </p>
                      <p className="text-xs text-muted-foreground">Similarity: {(suggestion.score * 100).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <Button
            type="submit"
            className="w-full px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-black/20 transition"
            disabled={isLoading || !searchQuery.trim()}
          >
            {(isLoading && !isSuggestionLoading) ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <SearchIconLucide className="mr-2 h-5 w-5" />
            )}
            Search or Create
          </Button>
        </form>
        <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
