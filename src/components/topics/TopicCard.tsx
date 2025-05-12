import type { Topic } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, Users, ThumbsUp, ThumbsDown, Info } from 'lucide-react'; // Added Users, ThumbsUp, ThumbsDown, Info
import { Badge } from '../ui/badge';
import * as React from 'react';
import { getUserProfile } from '@/lib/firestoreActions';
import type { UserProfile } from '@/types';


interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const [creatorProfile, setCreatorProfile] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    async function fetchCreator() {
      if (topic.createdBy) {
        const profile = await getUserProfile(topic.createdBy);
        setCreatorProfile(profile);
      }
    }
    fetchCreator();
  }, [topic.createdBy]);

  const formattedDate = topic.createdAt ? new Date(topic.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';
  const totalStatements = (topic.scoreFor || 0) + (topic.scoreAgainst || 0) + (topic.scoreNeutral || 0);

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-xl hover:border-primary/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold line-clamp-2 hover:text-primary transition-colors">
          <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Created by {creatorNameDisplay}
        </CardDescription>
      </CardHeader>
      {/* Description is now AI-generated summary */}
      {topic.description && ( 
        <CardContent className="flex-grow">
          <p className="text-sm text-foreground/80 line-clamp-3">{topic.description}</p>
        </CardContent>
      )}
      <CardFooter className="flex flex-col items-start gap-3 pt-4 border-t">
        <div className="flex justify-between w-full items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{totalStatements} statements</span>
          </div>
        </div>
        {/* Display scores if available */}
        {(topic.scoreFor > 0 || topic.scoreAgainst > 0 || topic.scoreNeutral > 0) && (
          <div className="flex flex-wrap gap-2 text-xs mt-1">
            <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
              <ThumbsUp className="h-3 w-3 mr-1" /> {topic.scoreFor} For
            </Badge>
            <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-400">
              <ThumbsDown className="h-3 w-3 mr-1" /> {topic.scoreAgainst} Against
            </Badge>
            <Badge variant="outline" className="border-gray-500/50 text-gray-600 dark:text-gray-400">
              <Info className="h-3 w-3 mr-1" /> {topic.scoreNeutral} Neutral
            </Badge>
          </div>
        )}
        {/* Tags removed from schema */}
        <Button asChild variant="outline" size="sm" className="w-full mt-2">
          <Link href={`/topics/${topic.id}`}>View Debate</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
