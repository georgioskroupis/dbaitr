// src/app/page.tsx
"use client";

import { useState, type FormEvent, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/layout/Logo';
import { useToast } from '@/hooks/use-toast';
import { getTopicByTitle } from '@/lib/firestoreActions';
import { cn, debounce } from '@/lib/utils';
import { TopNav } from '@/components/layout/TopNav';
import { getSemanticTopicSuggestions } from '@/app/actions/searchActions';
import type { FindSimilarTopicsOutput } from '@/ai/flows/find-similar-topics';


export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For main form submission
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FindSimilarTopicsOutput['suggestions']>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  const videoUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-video-bg.mp4?alt=media";
  const actionButtonIconUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-debate-icon-white.png?alt=media&token=498c3433-2870-440d-aa40-3634a450c8ad";

  const MIN_CHARS_FOR_SEARCH = 1; // Adjusted to allow search from first character

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchSuggestions = useCallback(
    debounce(async (query: string) => {
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
            console.log('landing suggestions results:', result.suggestions, 'for query:', query);
        }
        if (result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
          setShowSuggestions(true); 
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSuggestionLoading(false);
        if (process.env.NODE_ENV !== "production") {
            console.log('landing suggestions final state:', suggestions, showSuggestions, isSuggestionLoading);
        }
      }
    }, 300),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveSuggestionIndex(-1); // Reset active suggestion on new input
    if (!query.trim() || query.length < MIN_CHARS_FOR_SEARCH) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestionLoading(false);
    } else {
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
        toast({ title: "Topic Not Found", description: `Could not find details for "${title}". You can create it.`, variant: "default" });
        router.push(`/topics/new?title=${encodeURIComponent(title)}`);
      }
    } catch (error) {
      console.error("Error navigating to suggested topic:", error);
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
      // Allow form submission if Enter is pressed without an active suggestion
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

    const exactMatchInCurrentSuggestions = suggestions.find(s => s.title.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactMatchInCurrentSuggestions && activeSuggestionIndex === -1) { // Only if no suggestion was actively selected by keyboard
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
    } catch (error: any) {
      console.error("Detailed error: Error during topic search or initial creation step:", error);
      toast({
        title: "Search/Create Topic Error",
        description: `Something went wrong while trying to search for or create the topic "${searchQuery.trim()}". Please check your internet connection and try again. Error detail: ${error.message || 'Unknown error.'}`,
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
        setActiveSuggestionIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchContainerRef]);

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


  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      <TopNav variant="landing" />
      <div className={cn(
        "flex flex-1 flex-col items-center justify-center p-4 md:p-8 relative", 
      )}>
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover z-[-2]"
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-[-1]"></div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-2xl text-center space-y-8">
          <Logo width={280} href="/" /> 

          <form onSubmit={handleSearchSubmit} className="w-full space-y-6">
            <div className="relative group w-full max-w-xl mx-auto" ref={searchContainerRef}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="absolute left-4 top-[20%] h-6 w-6 text-white animate-gavel-strike-paused origin-bottom-left z-10"
              >
                <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
                <path d="m16 16 6-6"></path>
                <path d="m8 8 6-6"></path>
                <path d="m9 7 8 8"></path>
                <path d="m21 11-8-8"></path>
              </svg>
              <Input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="What are you debating about?"
                className="w-full pl-12 pr-12 py-3 text-base md:text-lg lg:text-xl placeholder:text-base md:placeholder:text-lg lg:placeholder:text-xl rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur-md transition h-12"
                disabled={isLoading}
                aria-label="Search debate topic"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                aria-label="Search or Create Topic"
                className="absolute right-[0.38rem] top-1/2 -translate-y-1/2 h-9 w-9 rounded-md bg-primary hover:bg-primary/90 text-white shadow-md flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition"
              >
                {isLoading && !isSuggestionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/80" />
                ) : (
                  <img
                    src={actionButtonIconUrl}
                    alt="Search"
                    className="h-5 w-5"
                  />
                )}
              </button>
             
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto text-left">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.title + index} // Using index for key if titles aren't guaranteed unique
                      className={cn(
                        "p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0",
                        index === activeSuggestionIndex && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSuggestionClick(suggestion.title)}
                      onMouseDown={(e) => e.preventDefault()} 
                    >
                      <p className="font-medium text-sm text-foreground">
                        {renderHighlightedTitle(suggestion.title, suggestion.matchedPhrase)}
                      </p>
                      <p className="text-xs text-muted-foreground">Similarity: {(suggestion.score * 100).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              )}
               {isSuggestionLoading && suggestions.length === 0 && searchQuery.trim().length >= MIN_CHARS_FOR_SEARCH && (
                 <div className="absolute top-full left-0 right-0 mt-1 w-full bg-card border border-border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground text-left">
                    Loading suggestions...
                  </div>
               )}
            </div>
          </form>
        </div>
        <p className="relative z-10 mt-auto pt-8 text-center text-base text-white/50 font-light footer-text">
          &copy; {new Date().getFullYear()} db8. All rights reserved.
        </p>
      </div>
    </div>
  );
}
