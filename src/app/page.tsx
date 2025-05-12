
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { useToast } from '@/hooks/use-toast';
import { findSimilarTopics } from '@/ai/flows/find-similar-topics';
import { getAllTopicTitles, getTopicByTitle } from '@/lib/firestoreActions';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingTopicTitles, setExistingTopicTitles] = useState<string[]>([]);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const titles = await getAllTopicTitles();
        setExistingTopicTitles(titles);
      } catch (error) {
        console.error("Failed to load existing topic titles:", error);
        toast({
          title: "Error",
          description: "Could not load existing topics. Please try again later.",
          variant: "destructive",
        });
      }
    }
    fetchTopics();
  }, [toast]);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: "Empty Search", description: "Please enter a topic to search or create.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const similarTopicsResult = await findSimilarTopics({
        newTopic: searchQuery,
        existingTopics: existingTopicTitles,
      });

      if (similarTopicsResult.isSimilar && similarTopicsResult.closestMatch) {
        // Attempt to find the exact topic by title to get its ID
        const existingTopic = await getTopicByTitle(similarTopicsResult.closestMatch);
        if (existingTopic?.id) {
          toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
          router.push(`/topics/${existingTopic.id}`);
          return;
        }
      }
      
      // If not similar enough or specific match not found by ID, proceed to create new
      toast({ title: "Create New Topic", description: `No direct match found. Let's create "${searchQuery}".` });
      router.push(`/topics/new?title=${encodeURIComponent(searchQuery)}`);

    } catch (error) {
      console.error("Error handling search/create:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "auth-background-glow flex min-h-screen flex-col items-center justify-center p-4 md:p-8",
    )}>
      <div className="relative z-10 flex flex-col items-center w-full max-w-xl text-center">
        <Logo width={200} href="/" />
        <p className="mt-4 mb-10 text-lg text-foreground/90">
          Explore ongoing debates or spark a new one.
        </p>
        
        <form onSubmit={handleSearchSubmit} className="w-full space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What would you like to debate?"
              className="w-full pl-10 pr-4 py-3 text-base rounded-md border-2 border-input focus:border-primary transition-colors"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full sm:w-auto text-base px-8 py-3"
            size="lg"
            disabled={isLoading || !searchQuery.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            Explore or Create Topic
          </Button>
        </form>
        
        <p className="mt-12 text-sm text-muted-foreground">
          Or, <Button variant="link" className="p-0 text-primary" onClick={() => router.push('/dashboard')}>browse all topics</Button>.
        </p>
      </div>
       <p className="relative z-10 mt-auto pt-8 text-center text-sm text-foreground/70 font-light footer-text">
        &copy; {new Date().getFullYear()} db8. All rights reserved.
      </p>
    </div>
  );
}
