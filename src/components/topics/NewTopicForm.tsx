
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, Sparkles, AlertTriangle, CheckCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { createTopic, getAllTopicTitles, updateTopicWithAnalysis } from "@/lib/firestoreActions";
import { checkTopicSimilarity, type CheckTopicSimilarityOutput } from "@/ai/flows/prevent-duplicate-topics";
import { generateTopicAnalysis } from "@/ai/flows/generate-topic-analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters.").max(150, "Title must be at most 150 characters."),
  description: z.string().max(500, "Description must be at most 500 characters.").optional(),
});

type NewTopicFormValues = z.infer<typeof formSchema>;

export function NewTopicForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, userProfile, isVerified, loading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [checkingSimilarity, setCheckingSimilarity] = React.useState(false);
  const [similarityResult, setSimilarityResult] = React.useState<CheckTopicSimilarityOutput | null>(null);

  const form = useForm<NewTopicFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  });

  React.useEffect(() => {
    const prefilledTitle = searchParams.get('title');
    if (prefilledTitle) {
      form.setValue('title', decodeURIComponent(prefilledTitle));
      // Trigger similarity check for prefilled title
      handleTitleChange({ target: { value: decodeURIComponent(prefilledTitle) } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [searchParams, form]);


  const titleDebounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = event.target.value;
    form.setValue("title", newTitle, { shouldValidate: true });
    
    if (titleDebounceTimeoutRef.current) {
      clearTimeout(titleDebounceTimeoutRef.current);
    }

    if (newTitle.length >= 10) {
      titleDebounceTimeoutRef.current = setTimeout(async () => {
        setCheckingSimilarity(true);
        setSimilarityResult(null);
        try {
          const existingTopics = await getAllTopicTitles();
          const result = await checkTopicSimilarity({ newTopic: newTitle, existingTopics });
          setSimilarityResult(result);
        } catch (error) {
          console.error("Error checking topic similarity:", error);
          // Do not toast here, as it can be annoying during typing
        } finally {
          setCheckingSimilarity(false);
        }
      }, 1000); // 1 second debounce
    } else {
      setSimilarityResult(null); // Clear results if title is too short
    }
  };


  async function onSubmit(values: NewTopicFormValues) {
    if (!user || !userProfile) {
      toast({ title: "Authentication Required", description: "Please sign in to create a topic.", variant: "destructive" });
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (!isVerified) {
      toast({ title: "Verification Required", description: "Please verify your ID to create topics.", variant: "destructive" });
      router.push('/verify-identity'); // Verification page will redirect back or to dashboard
      return;
    }

    if (similarityResult?.isSimilar && (similarityResult.similarityScore || 0) > 0.7) {
        toast({
            title: "Topic Potentially Similar",
            description: "This topic seems very similar to an existing one. Please consider revising or checking the existing topic.",
            variant: "destructive"
        });
        return;
    }

    setLoading(true);
    try {
      const newTopic = await createTopic(values.title, values.description, user.uid, userProfile.displayName);
      
      // Generate AI analysis in the background (don't block redirect)
      generateTopicAnalysis({ topic: values.title })
        .then(analysisResult => {
          if (analysisResult.analysis && newTopic.id) {
            updateTopicWithAnalysis(newTopic.id, analysisResult.analysis);
          }
        })
        .catch(err => console.error("Failed to generate topic analysis:", err));
      
      toast({ title: "Topic Created!", description: `"${values.title}" is now live.` });
      router.push(`/topics/${newTopic.id}`);
    } catch (error: any) {
      console.error("Error creating topic:", error);
      toast({ title: "Failed to Create Topic", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Create a New Debate Topic
        </CardTitle>
        <CardDescription>
          Craft a compelling topic that will spark engaging discussions. Our AI will help check for uniqueness.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Title</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="e.g., Should AI have human rights?" {...field} onChange={handleTitleChange} />
                       {checkingSimilarity && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                  {similarityResult && similarityResult.guidanceMessage && (
                    <div className={`mt-2 p-3 rounded-md text-sm flex items-start gap-2 ${
                      similarityResult.isSimilar ? 'bg-destructive/10 text-destructive-foreground border border-destructive/30' : 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30'
                    }`}>
                      {similarityResult.isSimilar ? <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" /> : <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />}
                      <div>
                        <p className="font-semibold">{similarityResult.isSimilar ? "Potential Duplicate" : "Looks Unique!"}</p>
                        <p>{similarityResult.guidanceMessage}</p>
                        {similarityResult.isSimilar && similarityResult.closestMatch && (
                          <p className="mt-1">Closest match: <span className="italic">{similarityResult.closestMatch}</span> (Similarity: {((similarityResult.similarityScore || 0) * 100).toFixed(0)}%)</p>
                        )}
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brief Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a short overview or context for your debate topic. (Max 500 characters)"
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full sm:w-auto" disabled={loading || checkingSimilarity || (similarityResult?.isSimilar && (similarityResult.similarityScore || 0) > 0.7) }>
              {(loading || checkingSimilarity) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Topic
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
