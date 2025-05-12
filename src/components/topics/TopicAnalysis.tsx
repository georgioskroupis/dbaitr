import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface TopicAnalysisProps {
  analysis?: string | null;
  isLoading?: boolean;
}

export function TopicAnalysis({ analysis, isLoading }: TopicAnalysisProps) {
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-primary/80">
            <Lightbulb className="h-5 w-5 animate-pulse" />
            AI Topic Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-muted-foreground/10 rounded animate-pulse"></div>
            <div className="h-4 bg-muted-foreground/10 rounded animate-pulse w-5/6"></div>
            <div className="h-4 bg-muted-foreground/10 rounded animate-pulse w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null; // Or a message indicating no analysis available
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-primary/90">
          <Lightbulb className="h-5 w-5" />
          AI Topic Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{analysis}</p>
      </CardContent>
    </Card>
  );
}
