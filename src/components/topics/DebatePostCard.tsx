import type { Post } from '@/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, MessageSquare, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface DebatePostCardProps {
  post: Post;
}

export function DebatePostCard({ post }: DebatePostCardProps) {
  const timeAgo = post.createdAt ? formatDistanceToNow(new Date(post.createdAt.seconds * 1000), { addSuffix: true }) : '';
  
  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-5 w-5" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  }

  return (
    <Card className="mb-4 bg-card/80 shadow-md">
      <CardHeader className="flex flex-row items-center space-x-3 p-4">
        <Avatar className="h-10 w-10">
           <AvatarImage src={post.userPhotoURL || undefined} alt={post.userName || 'User'} data-ai-hint="profile avatar" />
           <AvatarFallback className="bg-primary/20 text-primary font-semibold">
             {getInitials(post.userName)}
           </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{post.userName || 'Anonymous User'}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {post.position && (
          <Badge 
            // Use explicit background colors based on theme variables for success (For) and destructive (Against)
            className={`ml-auto text-xs 
              ${post.position === 'For' 
                ? 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]' 
                : 'bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-[hsl(var(--destructive-foreground))]'
              }
              font-medium uppercase tracking-wider`}
            style={{ letterSpacing: '0.5px' }} // As per typography guidelines for FOR/AGAINST tags
          >
            {post.position === 'For' ? <ThumbsUp className="h-3 w-3 mr-1" /> : <ThumbsDown className="h-3 w-3 mr-1" />}
            {post.position}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Style for quotes/highlighted arguments - could be applied here if post.content is a quote */}
        {/* For now, standard paragraph. If it's a quote, could add: `italic border-l-2 border-primary pl-3` */}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </CardContent>
      {/* Footer for actions like reply, like, etc. - Future enhancement */}
      {/* <CardFooter className="p-4 pt-2 border-t">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
          <MessageSquare className="h-4 w-4 mr-1" /> Reply
        </Button>
      </CardFooter> */}
    </Card>
  );
}
