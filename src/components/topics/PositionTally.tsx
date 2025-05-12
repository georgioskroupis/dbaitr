import type { Post } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PositionTallyProps {
  posts: Post[];
  isLoading?: boolean;
}

export function PositionTally({ posts, isLoading }: PositionTallyProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground/80">
            <Users className="h-5 w-5 animate-pulse" />
            Debate Stance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 bg-muted-foreground/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-muted-foreground/10 rounded animate-pulse"></div>
          <div className="h-4 bg-muted-foreground/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-muted-foreground/10 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  const forCount = posts.filter(p => p.position === 'For').length;
  const againstCount = posts.filter(p => p.position === 'Against').length;
  const totalCount = forCount + againstCount;
  const forPercentage = totalCount > 0 ? (forCount / totalCount) * 100 : 0;
  const againstPercentage = totalCount > 0 ? (againstCount / totalCount) * 100 : 0;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-foreground/90">
          <Users className="h-5 w-5" />
          Debate Stance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-green-500 flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" /> For ({forCount})
            </span>
            <span className="text-sm text-muted-foreground">{forPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={forPercentage} className="h-3 [&>div]:bg-green-500" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-red-500 flex items-center">
              <ThumbsDown className="h-4 w-4 mr-1" /> Against ({againstCount})
            </span>
            <span className="text-sm text-muted-foreground">{againstPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={againstPercentage} className="h-3 [&>div]:bg-red-500" />
        </div>
        {totalCount === 0 && (
          <p className="text-sm text-center text-muted-foreground pt-2">No positions stated yet. Be the first!</p>
        )}
      </CardContent>
    </Card>
  );
}
