
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface TopicAnalysisProps {
  analysis?: string | null;
  isLoading?: boolean;
}

export function TopicAnalysis({ analysis, isLoading }: TopicAnalysisProps) {
  if (isLoading) {
    return (
      <Card className="bg-black/20 backdrop-blur-sm border-rose-500/20 shadow-lg rounded-xl p-0">
        <CardHeader  className="p-4 pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-rose-300 font-semibold">
            <Lightbulb className="h-5 w-5 animate-pulse" />
            AI Topic Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded animate-pulse"></div>
            <div className="h-4 bg-white/10 rounded animate-pulse w-5/6"></div>
            <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null; 
  }

  return (
    <Card className="bg-black/40 backdrop-blur-md p-0 rounded-xl shadow-md border border-white/10">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-rose-400 font-semibold">
          <Lightbulb className="h-5 w-5" />
          AI Topic Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{analysis}</p>
      </CardContent>
    </Card>
  );
}
