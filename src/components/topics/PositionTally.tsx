import type { Topic, Statement } from '@/types'; // Updated to use Topic and Statement
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Users, Info } from 'lucide-react'; // Added Info for Neutral
import { Progress } from '@/components/ui/progress';

interface PositionTallyProps {
  topic: Topic; // Now expects the full Topic object
  isLoading?: boolean;
}

export function PositionTally({ topic, isLoading }: PositionTallyProps) {
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
          <div className="h-4 bg-muted-foreground/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-muted-foreground/10 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  const { scoreFor, scoreAgainst, scoreNeutral } = topic;
  const totalCount = scoreFor + scoreAgainst + scoreNeutral;

  const forPercentage = totalCount > 0 ? (scoreFor / totalCount) * 100 : 0;
  const againstPercentage = totalCount > 0 ? (scoreAgainst / totalCount) * 100 : 0;
  const neutralPercentage = totalCount > 0 ? (scoreNeutral / totalCount) * 100 : 0;

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
            <span className="text-sm font-medium text-[hsl(var(--success))] flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" /> For ({scoreFor})
            </span>
            <span className="text-sm text-muted-foreground">{forPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={forPercentage} className="h-3 [&>div]:bg-[hsl(var(--success))]" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-[hsl(var(--destructive))] flex items-center">
              <ThumbsDown className="h-4 w-4 mr-1" /> Against ({scoreAgainst})
            </span>
            <span className="text-sm text-muted-foreground">{againstPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={againstPercentage} className="h-3 [&>div]:bg-[hsl(var(--destructive))]" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-muted-foreground flex items-center">
              <Info className="h-4 w-4 mr-1" /> Neutral ({scoreNeutral})
            </span>
            <span className="text-sm text-muted-foreground">{neutralPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={neutralPercentage} className="h-3 [&>div]:bg-muted-foreground" />
        </div>
        {totalCount === 0 && (
          <p className="text-sm text-center text-muted-foreground pt-2">No statements yet. Be the first!</p>
        )}
      </CardContent>
    </Card>
  );
}
