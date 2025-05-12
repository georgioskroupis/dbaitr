import type { Statement } from '@/types'; // Changed from Post to Statement
import { Card, CardContent, CardHeader } from '@/components/ui/card'; // Removed CardFooter for now
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, User, Info } from 'lucide-react'; // Added Info for Neutral
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import * as React from 'react'; // Import React for useEffect and useState
import { getUserProfile } from '@/lib/firestoreActions';
import type { UserProfile } from '@/types';

interface DebateStatementCardProps { // Changed from DebatePostCardProps
  statement: Statement; // Changed from post: Post
}

export function DebatePostCard({ statement }: DebateStatementCardProps) { // Component name kept for now
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
  
  const timeAgo = statement.createdAt ? formatDistanceToNow(new Date(statement.createdAt.seconds * 1000), { addSuffix: true }) : '';
  
  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-5 w-5" />; // Default icon if no name
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  }

  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;

  let positionIcon;
  let positionBadgeColor;

  switch (statement.position) {
    case 'For':
      positionIcon = <ThumbsUp className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]';
      break;
    case 'Against':
      positionIcon = <ThumbsDown className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-[hsl(var(--destructive-foreground))]';
      break;
    case 'Neutral':
      positionIcon = <Info className="h-3 w-3 mr-1" />; // Using Info icon for Neutral
      positionBadgeColor = 'bg-muted hover:bg-muted/90 text-muted-foreground border border-border'; // Neutral color
      break;
    default: // 'pending' or other
      positionIcon = null;
      positionBadgeColor = 'bg-gray-400 hover:bg-gray-500 text-white'; // Color for pending/unknown
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
      {/* Q&A section will be added here later */}
    </Card>
  );
}
