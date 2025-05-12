
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
  const { user, userProfile, isVerified, loading: authLoading } = useAuth();
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
          console.error(`Detailed error: Could not check if user ${user.uid} has posted a main statement for topic ${topic.id}:`, error);
          // Assuming they haven't posted to allow trying. An error here shouldn't block submission.
          // A toast could be shown, but might be too intrusive if it's a transient network issue.
          setHasPostedMainStatement(false); 
        } finally {
          setIsCheckingPostStatus(false);
        }
      } else {
        setIsCheckingPostStatus(false);
        setHasPostedMainStatement(false);
      }
    }
    // Only run if user is not in authLoading state.
    if (!authLoading) {
      checkPostStatus();
    }
  }, [user, topic.id, authLoading]);


  async function onSubmit(values: PostFormValues) {
    if (authLoading) return; 

    if (!user || !userProfile) {
      toast({ 
        title: "Authentication Required", 
        description: "Please sign in to share your statement. You'll be redirected to sign in, and then you can come back to post.", 
        variant: "destructive" 
      });
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (!isVerified) {
      toast({ 
        title: "Identity Verification Required", 
        description: "To maintain a fair and accountable debate space, please verify your ID before posting. You will be redirected to the verification page.", 
        variant: "destructive" 
      });
      router.push('/verify-identity'); 
      return;
    }
    if (hasPostedMainStatement) {
      toast({ 
        title: "Main Statement Already Submitted", 
        description: "You have already submitted your primary statement for this debate topic. Further interactions (like replies or Q&A) will be available in future updates.", 
        variant: "default" 
      });
      return;
    }

    setLoading(true);
    try {
      const classification = await classifyPostPosition({ topic: topic.title, post: values.content });
      
      await createPost(
        topic.id, 
        user.uid, 
        userProfile.displayName,
        userProfile.photoURL,
        values.content,
        classification.position,
        classification.confidence
      );
      
      toast({ title: "Post Submitted Successfully!", description: "Your contribution has been added to the debate and classified by our AI." });
      form.reset(); 
      setHasPostedMainStatement(true); 
      if (onPostCreated) onPostCreated();
    } catch (error: any) {
      console.error("Detailed error: Failed to create post. Values:", values, "Topic ID:", topic.id, "Error:", error);
      toast({ 
        title: "Failed to Submit Post", 
        description: `Your post could not be submitted due to an error. The system reported: ${error.message || "An unspecified issue."} This might involve the AI classification step or saving the post to the database. Please check your connection and try again. If the problem persists, please contact support.`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || isCheckingPostStatus) {
    return (
      <div className="p-6 rounded-lg border bg-card shadow-sm mt-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading your posting status...</p>
      </div>
    );
  }

  if (hasPostedMainStatement) {
    return (
      <Alert className="mt-6 border-primary/30 bg-primary/5 text-center">
        <MessageSquare className="h-5 w-5 text-primary mx-auto mb-2" />
        <AlertTitle className="text-primary/90 font-semibold">Main Statement Submitted</AlertTitle>
        <AlertDescription className="text-foreground/80">
          You have already shared your main perspective on this topic. Thank you for your contribution!
        </AlertDescription>
      </Alert>
    );
  }


  const canSubmit = user && isVerified;

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
                  placeholder={
                    !user 
                      ? "Please sign in to contribute to the debate." 
                      : !isVerified 
                      ? "Please verify your identity to participate."
                      : "Share your main argument or perspective on this topic..."
                  }
                  className="resize-none min-h-[120px]"
                  rows={5}
                  {...field}
                  disabled={loading || !user || !isVerified || hasPostedMainStatement}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="mt-4 w-full sm:w-auto" 
          disabled={loading || !user || !isVerified || hasPostedMainStatement || authLoading || isCheckingPostStatus}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit Post
        </Button>
        
        {!user && (
           <p className="mt-2 text-xs text-destructive">
            <Button variant="link" className="p-0 text-destructive hover:text-destructive/80 h-auto" onClick={() => {
                 const currentPath = window.location.pathname + window.location.search;
                 router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
            }}>Sign in</Button> to participate.
          </p>
        )}
        {user && !isVerified && (
          <p className="mt-2 text-xs text-destructive">
            You need to <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link> to participate in debates.
          </p>
        )}
        </div>
      </form>
    </Form>
  );
}

