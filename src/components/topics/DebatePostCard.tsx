
import type { Statement } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, User, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import * as React from 'react';
import { getUserProfile } from '@/lib/firestoreActions';
import type { UserProfile } from '@/types';

interface DebateStatementCardProps {
  statement: Statement;
}

export function DebatePostCard({ statement }: DebateStatementCardProps) {
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    async function fetchAuthor() {
      if (statement.createdBy) {
        const profile = await getUserProfile(statement.createdBy);
        setAuthorProfile(profile);
      }
    }
    fetchAuthor();
  }, [statement.createdBy]);

  const timeAgo = statement.createdAt ? formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true }) : '';

  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-5 w-5" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  }

  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;

  let positionIcon;
  let positionBadgeColor;

  switch (statement.position) {
    case 'for': // Ensure consistency with AI flow output if it's lowercase
      positionIcon = <ThumbsUp className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]';
      break;
    case 'against': // Ensure consistency
      positionIcon = <ThumbsDown className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-[hsl(var(--destructive-foreground))]';
      break;
    case 'neutral': // Ensure consistency
      positionIcon = <Info className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-muted hover:bg-muted/90 text-muted-foreground border border-border';
      break;
    default: // 'pending' or other
      positionIcon = null;
      positionBadgeColor = 'bg-yellow-500 hover:bg-yellow-600 text-black'; // Changed pending color for visibility
  }

  return (
    <Card className="mb-4 bg-card/80 shadow-md">
      <CardHeader className="flex flex-row items-center space-x-3 p-4">
        <Avatar className="h-10 w-10">
           <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
           <AvatarFallback className="bg-primary/20 text-primary font-semibold">
             {getInitials(displayName)}
           </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {statement.position && statement.position !== 'pending' && (
          <Badge
            className={`ml-auto text-xs ${positionBadgeColor} font-medium uppercase tracking-wider`}
            style={{ letterSpacing: '0.5px' }}
          >
            {positionIcon}
            {statement.position}
          </Badge>
        )}
         {statement.position === 'pending' && (
          <Badge className="ml-auto text-xs bg-yellow-500 text-black font-medium uppercase tracking-wider">
            Pending AI
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{statement.content}</p>
        {statement.aiConfidence !== undefined && statement.position !== 'pending' && (
           <p className="text-xs text-muted-foreground mt-2">AI Confidence: {(statement.aiConfidence * 100).toFixed(0)}%</p>
        )}
      </CardContent>
    </Card>
  );
}
