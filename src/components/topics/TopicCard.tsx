
import type { Topic } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, Users, ThumbsUp, ThumbsDown, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import * as React from 'react';
import { getUserProfile } from '@/lib/firestoreActions';
import type { UserProfile } from '@/types';
import { format } from 'date-fns';
import { getAuthorStatusBadge } from '@/lib/utils'; 

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

  const formattedDate = topic.createdAt ? format(new Date(topic.createdAt), 'MM/dd/yyyy') : 'N/A';
  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';
  const totalStatements = (topic.scoreFor || 0) + (topic.scoreAgainst || 0) + (topic.scoreNeutral || 0);
  const creatorStatusBadge = getAuthorStatusBadge(creatorProfile);


  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-2xl hover:border-rose-500/50 bg-black/40 backdrop-blur-md rounded-xl shadow-md border border-white/10">
      <CardHeader className="p-4">
        <CardTitle className="text-xl font-semibold line-clamp-2 text-white hover:text-rose-400 transition-colors">
          <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <span>Created by {creatorNameDisplay}</span>
          {creatorStatusBadge && (
            <Badge variant={creatorStatusBadge.variant as any} className={`text-xs py-0.5 px-1.5 ${authorStatusBadge.variant === 'destructive' ? 'bg-red-700/80 border-red-500/50 text-red-200' : 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'}`}>
              {creatorStatusBadge.icon && React.cloneElement(creatorStatusBadge.icon, {className: "h-3 w-3 mr-1"})}
              {creatorStatusBadge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      {topic.description && (
        <CardContent className="flex-grow p-4 pt-0">
          <p className="text-sm text-white/80 line-clamp-3">{topic.description}</p>
        </CardContent>
      )}
      <CardFooter className="flex flex-col items-start gap-3 p-4 pt-4 border-t border-white/10">
        <div className="flex justify-between w-full items-center text-xs text-white/50">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{totalStatements} statements</span>
          </div>
        </div>
        {(topic.scoreFor > 0 || topic.scoreAgainst > 0 || topic.scoreNeutral > 0) && (
          <div className="flex flex-wrap gap-2 text-xs mt-1">
            <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
              <ThumbsUp className="h-3 w-3 mr-1" /> {topic.scoreFor} For
            </Badge>
            <Badge variant="outline" className="border-rose-500/50 text-rose-400 bg-rose-500/10">
              <ThumbsDown className="h-3 w-3 mr-1" /> {topic.scoreAgainst} Against
            </Badge>
            <Badge variant="outline" className="border-gray-500/50 text-gray-400 bg-gray-500/10">
              <Info className="h-3 w-3 mr-1" /> {topic.scoreNeutral} Neutral
            </Badge>
          </div>
        )}
        <Button asChild className="w-full mt-2 px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" size="sm">
          <Link href={`/topics/${topic.id}`}>View Debate</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
