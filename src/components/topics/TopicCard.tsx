import type { Topic } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageSquare, Users, CalendarDays } from 'lucide-react';
import { Badge } from '../ui/badge';

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const formattedDate = topic.createdAt ? new Date(topic.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-xl hover:border-primary/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold line-clamp-2 hover:text-primary transition-colors">
          <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Created by {topic.creatorName || 'Anonymous'}
        </CardDescription>
      </CardHeader>
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
          {/* Placeholder for post/participant count */}
          {/* <div className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{topic.postCount || 0} posts</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{topic.participantCount || 0} participants</span>
          </div> */}
        </div>
        {topic.tags && topic.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {topic.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="w-full mt-2">
          <Link href={`/topics/${topic.id}`}>View Debate</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
