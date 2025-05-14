// src/components/search/GlobalSearchModal.tsx
"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findSimilarTopics } from '@/ai/flows/find-similar-topics';
import { getAllTopicTitles, getTopicByTitle } from '@/lib/firestoreActions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { GavelIcon } from '@/components/layout/GavelIcon';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({ isOpen, onOpenChange }: GlobalSearchModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingTopicTitles, setExistingTopicTitles] = useState<string[]>([]);

  useState(() => {
    async function fetchTopics() {
      try {
        const titles = await getAllTopicTitles();
        setExistingTopicTitles(titles);
      } catch (error) {
        console.error("GlobalSearchModal: Failed to load existing topic titles:", error);
        toast({
          title: "Error Loading Topic Data",
          description: "Could not load existing topics for search. Please try again.",
          variant: "destructive",
        });
      }
    }
    if (isOpen) { // Fetch topics when modal opens, if not already fetched
        fetchTopics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, toast]);

  const handleSearchSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
        const existingTopic = await getTopicByTitle(similarTopicsResult.closestMatch);
        if (existingTopic?.id) {
          toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
          router.push(`/topics/${existingTopic.id}`);
          onOpenChange(false); // Close modal on navigation
          return;
        }
      }

      toast({ title: "Create New Topic", description: `Let's create "${searchQuery}".` });
      router.push(`/topics/new?title=${encodeURIComponent(searchQuery)}`);
      onOpenChange(false); // Close modal on navigation

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What would you like to debate?"
              className="w-full pl-10 pr-4 py-3 text-base rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-rose-500 backdrop-blur-md transition h-12"
              disabled={isLoading}
              aria-label="Search debate topic"
            />
          </div>
          <Button
            type="submit"
            className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition"
            disabled={isLoading || !searchQuery.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Search className="mr-2 h-5 w-5" />
            )}
            Search or Create
          </Button>
        </form>
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
