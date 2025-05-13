
import type { Topic, Statement } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Users, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PositionTallyProps {
  topic: Topic; 
  isLoading?: boolean;
}

export function PositionTally({ topic, isLoading }: PositionTallyProps) {
  if (isLoading) {
    return (
      <Card className="bg-black/20 backdrop-blur-sm border-white/10 shadow-lg rounded-xl p-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-white/80 font-semibold">
            <Users className="h-5 w-5 animate-pulse" />
            Debate Stance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-white/10 rounded animate-pulse"></div>
          <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-white/10 rounded animate-pulse"></div>
          <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
          <div className="h-8 bg-white/10 rounded animate-pulse"></div>
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
    <Card className="bg-black/40 backdrop-blur-md p-0 rounded-xl shadow-md border border-white/10">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-white font-semibold">
          <Users className="h-5 w-5" />
          Debate Stance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-green-400 flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" /> For ({scoreFor})
            </span>
            <span className="text-sm text-white/50">{forPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={forPercentage} className="h-3 bg-white/10 [&>div]:bg-green-500" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-rose-400 flex items-center">
              <ThumbsDown className="h-4 w-4 mr-1" /> Against ({scoreAgainst})
            </span>
            <span className="text-sm text-white/50">{againstPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={againstPercentage} className="h-3 bg-white/10 [&>div]:bg-rose-500" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-400 flex items-center">
              <Info className="h-4 w-4 mr-1" /> Neutral ({scoreNeutral})
            </span>
            <span className="text-sm text-white/50">{neutralPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={neutralPercentage} className="h-3 bg-white/10 [&>div]:bg-gray-500" />
        </div>
        {totalCount === 0 && (
          <p className="text-sm text-center text-white/50 pt-2">No statements yet. Be the first!</p>
        )}
      </CardContent>
    </Card>
  );
}
