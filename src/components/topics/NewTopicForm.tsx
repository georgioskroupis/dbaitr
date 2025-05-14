
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, AlertTriangle, CheckCircle } from "lucide-react"; // Removed Search
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
import { createTopic, updateTopicDescriptionWithAISummary } from "@/lib/firestoreActions"; // Removed getAllTopicTitles
// Removed checkTopicSimilarity, type CheckTopicSimilarityOutput from AI flows
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
  const { user, userProfile, kycVerified, loading: authLoading, isSuspended } = useAuth();
  const [loading, setLoading] = React.useState(false);
  // Removed state related to similarity checking (existingTopicTitles, checkingSimilarity, similarityResult)

  const form = useForm<NewTopicFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  });

  React.useEffect(() => {
    const prefilledTitle = searchParams.get('title');
    if (prefilledTitle) {
      form.setValue('title', decodeURIComponent(prefilledTitle));
      // No need to call handleTitleChange as similarity check is removed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, form]);

  // Removed handleTitleChange and titleDebounceTimeoutRef as similarity check on typing is removed

  async function onSubmit(values: NewTopicFormValues) {
    if (authLoading) { 
        toast({ title: "Please wait", description: "Authenticating...", variant: "default" });
        return;
    }

    if (!user || !userProfile) {
      toast({ 
        title: "Authentication Required", 
        description: "To create a new debate topic, you need to be signed in. Please sign in or create an account, and you'll be brought back here to complete your topic.", 
        variant: "destructive",
        duration: 7000,
      });
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/auth?returnTo=${encodeURIComponent(currentPath)}`); 
      return;
    }

    if (isSuspended) {
      toast({
        title: "Account Access Restricted",
        description: "Your account is currently restricted. Please complete your identity verification to create new topics.",
        variant: "destructive",
        duration: 7000,
      });
      router.push('/account-suspended');
      return;
    }
    
    if (!kycVerified) {
      toast({ 
        title: "Identity Verification Required", 
        description: "To ensure a fair and accountable debate, identity verification (KYC) is needed to create new topics. Please complete the verification process (you have a 10-day grace period). You'll be redirected to the verification page and can return here afterwards.", 
        variant: "destructive",
        duration: 7000,
      });
      router.push('/verify-identity'); 
      return;
    }

    // Removed similarity check before submission
    // if (similarityResult?.isSimilar && (similarityResult.similarityScore || 0) > 0.7) { ... }

    setLoading(true);
    try {
      const newTopic = await createTopic(values.title, values.description, user.uid);
      
      // AI summary generation remains
      generateTopicAnalysis({ topic: values.title })
        .then(analysisResult => {
          if (analysisResult.analysis && newTopic.id) {
            updateTopicDescriptionWithAISummary(newTopic.id, analysisResult.analysis);
          }
        })
        .catch(err => {
          console.error("Background task: Failed to generate AI topic summary after topic creation. Topic ID:", newTopic.id, "Error:", err);
          // Optionally toast a non-critical error or log to an error monitoring service
        });
      
      toast({ title: "Topic Created Successfully!", description: `Your debate topic "${values.title}" is now live and ready for discussion.` });
      router.push(`/topics/${newTopic.id}`);
    } catch (error: any) {
      console.error("Detailed error: Failed to create new topic. Values:", values, "Error:", error);
      toast({ 
        title: "Failed to Create Topic", 
        description: `An error occurred while trying to create your new topic. The system reported: ${error.message || "An unspecified error."} Please try submitting again. If the issue persists, it might be a temporary server problem or an issue with the provided details.`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }
  
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        <p className="ml-2 text-white/50">Loading user data...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/10">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-2xl flex items-center gap-2 text-white font-semibold">
          <Sparkles className="h-6 w-6 text-rose-400" /> Create a New Debate Topic
        </CardTitle>
        <CardDescription className="text-white/50">
          Craft a compelling topic that will spark engaging discussions. The topic description will be enhanced by AI after creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Topic Title</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="e.g., Should AI advancements be regulated more strictly?" 
                        {...field} 
                        // Removed onChange={handleTitleChange}
                        className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition"
                      />
                       {/* Removed checkingSimilarity loader */}
                    </div>
                  </FormControl>
                  <FormMessage />
                  {/* Removed similarityResult display block */}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Initial Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a short overview or context for your debate topic. This can be refined by AI later. (Max 500 characters)"
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition min-h-[120px] resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full sm:w-auto px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" disabled={loading || isSuspended }>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Topic
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
