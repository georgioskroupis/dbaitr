// src/components/search/GlobalSearchModal.tsx
"use client";

import { useState, type FormEvent, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search as SearchIconLucide, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getTopicByTitle } from '@/lib/firestoreActions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { GavelIcon } from '@/components/layout/GavelIcon';
import { getSemanticTopicSuggestions } from '@/app/actions/searchActions';
import type { FindSimilarTopicsOutput } from '@/ai/flows/find-similar-topics';
import { debounce } from '@/lib/utils';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({ isOpen, onOpenChange }: GlobalSearchModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For main form submission
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FindSimilarTopicsOutput['suggestions']>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Debounced function to fetch suggestions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setSuggestions([]);
        if(query.length > 0) setShowSuggestions(true); else setShowSuggestions(false);
        setIsSuggestionLoading(false);
        return;
      }
      setIsSuggestionLoading(true);
      try {
        const result = await getSemanticTopicSuggestions({ query });
        setSuggestions(result.suggestions);
      } catch (error) {
        console.error("GlobalSearchModal: Failed to fetch suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsSuggestionLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      setIsSuggestionLoading(false);
    } else {
        // Auto-focus input when modal opens
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100); // Small delay to ensure modal is rendered
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
     if (query.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestionLoading(false);
    } else {
      setShowSuggestions(true);
      debouncedFetchSuggestions(query);
    }
  };
  
  const handleSuggestionClick = async (title: string) => {
    setIsLoading(true); 
    setSearchQuery(title);
    setShowSuggestions(false);
    try {
      const topic = await getTopicByTitle(title);
      if (topic?.id) {
        router.push(`/topics/${topic.id}`);
      } else {
        router.push(`/topics/new?title=${encodeURIComponent(title)}`);
      }
      onOpenChange(false); 
    } catch (error) {
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

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactMatchInCurrentSuggestions) {
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
      onOpenChange(false); 
    } catch (error: any) {
      console.error("GlobalSearchModal: Error during topic search/create:", error);
      toast({
        title: "Search/Create Topic Error",
        description: `Something went wrong: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

    useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
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
      <DialogContent className="sm:max-w-[525px] bg-black/80 backdrop-blur-md border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-semibold text-rose-400">
            <GavelIcon className="h-6 w-6 mr-2 text-rose-400" /> Start the db8
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Search for an existing debate topic or create a new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearchSubmit} className="space-y-4 pt-4">
          <div className="relative" ref={searchContainerRef}>
            <SearchIconLucide className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <Input
              ref={inputRef} // Assign ref for auto-focus
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
              placeholder="What would you like to debate?"
              className="w-full pl-10 pr-4 py-3 text-base rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-rose-500 backdrop-blur-md transition h-12"
              disabled={isLoading}
              aria-label="Search debate topic"
              autoComplete="off"
            />
            {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto text-left">
                  {isSuggestionLoading && suggestions.length === 0 && searchQuery.trim().length >=3 && (
                    <p className="p-3 text-sm text-muted-foreground">Loading...</p>
                  )}
                  {!isSuggestionLoading && suggestions.length === 0 && searchQuery.trim().length >=3 && (
                    <p className="p-3 text-sm text-muted-foreground">No similar topics found.</p>
                  )}
                  {!isSuggestionLoading && suggestions.length === 0 && searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                    <p className="p-3 text-sm text-muted-foreground">Keep typing...</p>
                  )}
                  {suggestions.length > 0 && suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                      onClick={() => handleSuggestionClick(suggestion.title)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <p className="font-medium text-sm text-foreground">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">Similarity: {(suggestion.score * 100).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <Button
            type="submit"
            className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition"
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
