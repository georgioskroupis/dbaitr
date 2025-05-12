"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { createPost, checkIfUserHasPostedMainStatement } from "@/lib/firestoreActions";
import { classifyPostPosition } from "@/ai/flows/classify-post-position";
import type { Topic } from "@/types";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const formSchema = z.object({
  content: z.string().min(10, "Post must be at least 10 characters.").max(2000, "Post must be at most 2000 characters."),
});

type PostFormValues = z.infer<typeof formSchema>;

interface PostFormProps {
  topic: Topic;
  onPostCreated?: () => void; // Callback after post is created
}

export function PostForm({ topic, onPostCreated }: PostFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, isVerified } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [isCheckingPostStatus, setIsCheckingPostStatus] = React.useState(true);
  const [hasPostedMainStatement, setHasPostedMainStatement] = React.useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function checkPostStatus() {
      if (user && topic.id) {
        setIsCheckingPostStatus(true);
        try {
          const hasPosted = await checkIfUserHasPostedMainStatement(user.uid, topic.id);
          setHasPostedMainStatement(hasPosted);
        } catch (error) {
          console.error("Error checking post status:", error);
          toast({ title: "Error", description: "Could not check your posting status.", variant: "destructive" });
          // Assume they haven't posted to allow trying, or handle error more gracefully
          setHasPostedMainStatement(false); 
        } finally {
          setIsCheckingPostStatus(false);
        }
      } else if (!user) {
        // If no user, they obviously haven't posted. And form will be disabled by !isVerified anyway.
        setIsCheckingPostStatus(false);
        setHasPostedMainStatement(false);
      }
    }
    checkPostStatus();
  }, [user, topic.id, toast]);


  async function onSubmit(values: PostFormValues) {
    if (!user || !userProfile) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!isVerified) {
      toast({ title: "Verification Required", description: "Please verify your ID to post.", variant: "destructive" });
      router.push('/verify-identity');
      return;
    }
    if (hasPostedMainStatement) {
      toast({ title: "Already Posted", description: "You have already submitted your main statement for this topic.", variant: "default" });
      return;
    }

    setLoading(true);
    try {
      // 1. Classify post position using AI
      const classification = await classifyPostPosition({ topic: topic.title, post: values.content });
      
      // 2. Create post in Firestore
      await createPost(
        topic.id, 
        user.uid, 
        userProfile.displayName,
        userProfile.photoURL,
        values.content,
        classification.position,
        classification.confidence
      );
      
      toast({ title: "Post Submitted!", description: "Your contribution has been added to the debate." });
      form.reset(); 
      setHasPostedMainStatement(true); // Update status locally
      if (onPostCreated) onPostCreated();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast({ title: "Failed to Submit Post", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (isCheckingPostStatus) {
    return (
      <div className="p-6 rounded-lg border bg-card shadow-sm mt-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Checking your status...</p>
      </div>
    );
  }

  if (hasPostedMainStatement) {
    return (
      <Alert className="mt-6 border-primary/30 bg-primary/5 text-center">
        <MessageSquare className="h-5 w-5 text-primary mx-auto mb-2" />
        <AlertTitle className="text-primary/90 font-semibold">Main Statement Submitted</AlertTitle>
        <AlertDescription className="text-foreground/80">
          You have already shared your main perspective on this topic. You can engage further by asking questions on other posts.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1 rounded-lg border bg-card shadow-sm mt-6">
        <div className="p-6">
        <FormLabel className="text-lg font-semibold mb-2 block">Your Statement</FormLabel>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Share your main argument or perspective on this topic..."
                  className="resize-none min-h-[120px]"
                  rows={5}
                  {...field}
                  disabled={loading || !isVerified || hasPostedMainStatement}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={loading || !isVerified || hasPostedMainStatement || isCheckingPostStatus}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit Post
        </Button>
        {!isVerified && (
          <p className="mt-2 text-xs text-destructive">
            You need to <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link> to participate.
          </p>
        )}
        </div>
      </form>
    </Form>
  );
}
