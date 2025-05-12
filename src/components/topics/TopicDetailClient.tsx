
"use client";

import type { Topic, Statement as StatementType } from '@/types';
import { TopicAnalysis } from './TopicAnalysis';
import { PositionTally } from './PositionTally';
import { PostForm } from './PostForm';
import { DebatePostCard } from './DebatePostCard';
import { useEffect, useState, useCallback } from 'react';
import { getStatementsForTopic, getTopicById, updateTopicDescriptionWithAISummary, getUserProfile } from '@/lib/firestoreActions';
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import { format } from 'date-fns';


interface TopicDetailClientProps {
  initialTopic: Topic;
  initialPosts: StatementType[];
}

export function TopicDetailClient({ initialTopic, initialPosts: initialStatements }: TopicDetailClientProps) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [statements, setStatements] = useState<StatementType[]>(initialStatements);
  const [isLoadingTopicDetails, setIsLoadingTopicDetails] = useState<boolean>(!initialTopic.description);
  const [isLoadingStatements, setIsLoadingStatements] = useState<boolean>(false);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchCreator() {
      if (topic.createdBy) {
        const profile = await getUserProfile(topic.createdBy);
        setCreatorProfile(profile);
      }
    }
    fetchCreator();
  }, [topic.createdBy]);

  useEffect(() => {
    async function fetchAiSummary() {
      if (topic && (!topic.description || topic.description.trim() === '')) {
        setIsLoadingTopicDetails(true);
        try {
          const analysisResult = await generateTopicAnalysis({ topic: topic.title });
          if (analysisResult.analysis) {
            await updateTopicDescriptionWithAISummary(topic.id, analysisResult.analysis);
            setTopic(prev => ({ ...prev, description: analysisResult.analysis }));
          } else {
            console.warn("AI topic summary result was empty for topic:", topic.title);
          }
        } catch (error: any) {
          console.error(`Detailed error: Failed to generate or fetch AI topic summary for topic "${topic.title}" (ID: ${topic.id}):`, error);
          toast({
            title: "AI Summary Unavailable",
            description: `Could not load the AI-generated summary for this topic. This may be a temporary issue. Error: ${error.message || 'Unknown AI error.'}`,
            variant: "default",
            duration: 7000,
          });
        } finally {
          setIsLoadingTopicDetails(false);
        }
      } else if (topic && topic.description) {
         setIsLoadingTopicDetails(false);
      }
    }
    if (topic?.id && topic?.title) { // Ensure topic ID and title are present
        fetchAiSummary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, topic?.title, toast]); // Removed topic.description from deps to avoid loop if AI summary is empty

  const refreshData = useCallback(async () => {
    setIsLoadingStatements(true);
    setIsLoadingTopicDetails(true); // Also set topic details to loading as scores might change
    try {
      const [updatedStatements, updatedTopic] = await Promise.all([
        getStatementsForTopic(topic.id),
        getTopicById(topic.id)
      ]);
      setStatements(updatedStatements);
      if (updatedTopic) {
        // If AI summary was being fetched for the updatedTopic and it's still empty, don't overwrite
        // local state if it already got populated by the AI fetch.
        // This is a bit tricky, main thing is updatedTopic has new scores.
        setTopic(prev => ({
          ...updatedTopic,
          description: updatedTopic.description || prev.description // Preserve fetched AI description if new one is empty
        }));
      }
    } catch (error: any) {
      console.error(`Detailed error: Failed to refresh data for topic "${topic.title}" (ID: ${topic.id}):`, error);
      toast({
        title: "Data Refresh Failed",
        description: `Could not update data for this topic. Error: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingStatements(false);
      setIsLoadingTopicDetails(false);
    }
  }, [topic.id, topic.title, toast]);


  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';
  const topicCreatedAtDate = topic.createdAt ? format(new Date(topic.createdAt), 'MM/dd/yyyy') : 'N/A';


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">
          Created by {creatorNameDisplay} on {topicCreatedAtDate}
        </p>
        <TopicAnalysis analysis={topic.description} isLoading={isLoadingTopicDetails && !topic.description} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Debate Area</h2>
          {isLoadingStatements ? (
             Array.from({ length: 3 }).map((_, index) => (
                <Card className="mb-4 bg-card/80 shadow-md" key={index}>
                  <CardHeader className="flex flex-row items-center space-x-3 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </CardContent>
                </Card>
              ))
          ) : statements.length > 0 ? (
            statements.map(statement => <DebatePostCard key={statement.id} statement={statement} />)
          ) : (
            <Alert className="border-primary/30 bg-primary/5">
              <Terminal className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary/90">No Statements Yet!</AlertTitle>
              <AlertDescription className="text-foreground/80">
                This debate is just getting started. Be the first to share your statement!
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="md:col-span-1 space-y-6">
           <PositionTally topic={topic} isLoading={isLoadingTopicDetails} /> {/* isLoadingTopicDetails covers score loading */}
           <PostForm topic={topic} onStatementCreated={refreshData} />
        </div>
      </div>
    </div>
  );
}

