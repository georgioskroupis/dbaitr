
"use client";

import type { Topic, Statement as StatementType } from '@/types'; // Renamed PostType to StatementType
import { TopicAnalysis } from './TopicAnalysis';
import { PositionTally } from './PositionTally';
import { PostForm } from './PostForm'; // Assuming this is now StatementForm
import { DebatePostCard } from './DebatePostCard'; // Assuming this is now DebateStatementCard
import { useEffect, useState } from 'react';
import { getStatementsForTopic, getTopicById, updateTopicDescriptionWithAISummary, getUserProfile } from '@/lib/firestoreActions'; // Renamed getPostsForTopic
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react"; 
import { Skeleton } from '../ui/skeleton'; 
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';


interface TopicDetailClientProps {
  initialTopic: Topic;
  initialPosts: StatementType[]; // Renamed initialPosts to initialStatements, and PostType to StatementType
}

export function TopicDetailClient({ initialTopic, initialPosts: initialStatements }: TopicDetailClientProps) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [statements, setStatements] = useState<StatementType[]>(initialStatements); // Renamed posts to statements
  const [isLoadingTopicDetails, setIsLoadingTopicDetails] = useState<boolean>(!initialTopic.description); // Topic description is AI summary
  const [isLoadingStatements, setIsLoadingStatements] = useState<boolean>(false); // Renamed
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  // Fetch creator profile
  useEffect(() => {
    async function fetchCreator() {
      if (topic.createdBy) {
        const profile = await getUserProfile(topic.createdBy);
        setCreatorProfile(profile);
      }
    }
    fetchCreator();
  }, [topic.createdBy]);

  // Fetch AI summary for topic description if not present
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
    fetchAiSummary();
  }, [topic?.id, topic?.title, topic?.description, toast]);

  const refreshStatements = async () => { // Renamed refreshPosts
    setIsLoadingStatements(true);
    try {
      const updatedStatements = await getStatementsForTopic(topic.id); // Renamed
      setStatements(updatedStatements);
      // Also refresh topic data to get updated scores
      const updatedTopic = await getTopicById(topic.id);
      if (updatedTopic) {
        setTopic(updatedTopic);
      }
    } catch (error: any) {
      console.error(`Detailed error: Failed to refresh statements for topic "${topic.title}" (ID: ${topic.id}):`, error);
      toast({
        title: "Statement Refresh Failed", // Renamed
        description: `Could not update the list of statements for this topic. Error: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingStatements(false);
    }
  };

  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">
          Created by {creatorNameDisplay} on {topic.createdAt ? new Date(topic.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
        </p>
        {/* Topic Analysis component now shows the AI-generated description */}
        <TopicAnalysis analysis={topic.description} isLoading={isLoadingTopicDetails} />
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Debate Area</h2>
          {isLoadingStatements ? ( // Renamed
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
          ) : statements.length > 0 ? ( // Renamed
            statements.map(statement => <DebatePostCard key={statement.id} statement={statement} />) // Renamed post to statement
          ) : (
            <Alert className="border-primary/30 bg-primary/5">
              <Terminal className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary/90">No Statements Yet!</AlertTitle> {/* Renamed */}
              <AlertDescription className="text-foreground/80">
                This debate is just getting started. Be the first to share your statement! {/* Renamed */}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="md:col-span-1 space-y-6">
           {/* PositionTally now takes the full topic object to use scores directly */}
           <PositionTally topic={topic} isLoading={isLoadingStatements || isLoadingTopicDetails} />
           {/* Assuming PostForm is now StatementForm and onPostCreated is onStatementCreated */}
           <PostForm topic={topic} onStatementCreated={refreshStatements} /> 
        </div>
      </div>
    </div>
  );
}
