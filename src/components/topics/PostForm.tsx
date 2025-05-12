
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
import { createStatement, checkIfUserHasPostedStatement } from "@/lib/firestoreActions";
import type { Topic } from "@/types";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const formSchema = z.object({
  content: z.string().min(10, "Statement must be at least 10 characters.").max(2000, "Statement must be at most 2000 characters."),
});

type StatementFormValues = z.infer<typeof formSchema>;

interface StatementFormProps {
  topic: Topic;
  onStatementCreated?: () => void;
}

export function PostForm({ topic, onStatementCreated }: StatementFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, kycVerified, loading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = React.useState(true);
  const [hasPostedStatement, setHasPostedStatement] = React.useState(false);

  const form = useForm<StatementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function checkStatementStatus() {
      if (user && topic.id) {
        setIsCheckingStatus(true);
        try {
          const hasPosted = await checkIfUserHasPostedStatement(user.uid, topic.id);
          setHasPostedStatement(hasPosted);
        } catch (error) {
          console.error(`Detailed error: Could not check if user ${user.uid} has posted a statement for topic ${topic.id}:`, error);
          // Potentially inform user about this error
          toast({
            title: "Error Checking Statement Status",
            description: "Could not determine if you've already posted. Please try refreshing.",
            variant: "destructive"
          });
          setHasPostedStatement(false); 
        } finally {
          setIsCheckingStatus(false);
        }
      } else {
        setIsCheckingStatus(false);
        setHasPostedStatement(false); // If no user, they haven't posted.
      }
    }
    if (!authLoading) { // Only run when auth state is resolved
      checkStatementStatus();
    }
  }, [user, topic.id, authLoading, toast]);


  async function onSubmit(values: StatementFormValues) {
    if (authLoading) { // Explicitly wait for auth state resolution
        toast({ title: "Please wait", description: "Verifying authentication status...", variant: "default" });
        return;
    }

    if (!user || !userProfile) {
      toast({ 
        title: "Authentication Required", 
        description: "To share your statement, you need to be signed in. Please sign in or create an account, and you'll be returned here to post.", 
        variant: "destructive",
        duration: 7000,
      });
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (!kycVerified) {
      toast({ 
        title: "Identity Verification Required", 
        description: "To ensure a fair and accountable debate, identity verification (KYC) is required to post statements. Please complete the verification. You'll be redirected and can return here afterwards.", 
        variant: "destructive",
        duration: 7000,
      });
      router.push('/verify-identity'); 
      return;
    }
    if (hasPostedStatement) {
      toast({ 
        title: "Statement Already Submitted",
        description: "You have already submitted your statement for this debate topic. Further interactions (like replies or Q&A) will be available in future updates.", 
        variant: "default",
        duration: 7000,
      });
      return;
    }

    setLoading(true);
    try {
      await createStatement(
        topic.id, 
        user.uid, 
        values.content
      );
      
      toast({ title: "Statement Submitted Successfully!", description: "Your contribution has been added to the debate." });
      form.reset(); 
      setHasPostedStatement(true); 
      if (onStatementCreated) onStatementCreated();
    } catch (error: any) {
      console.error("Detailed error: Failed to create statement. Values:", values, "Topic ID:", topic.id, "Error:", error);
      toast({ 
        title: "Failed to Submit Statement",
        description: `Your statement could not be submitted due to an error. The system reported: ${error.message || "An unspecified issue."} This might involve the AI classification step or saving the statement to the database. Please check your connection and try again. If the problem persists, please contact support.`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || isCheckingStatus) {
    return (
      <div className="p-6 rounded-lg border bg-card shadow-sm mt-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading your statement status...</p>
      </div>
    );
  }

  if (hasPostedStatement) {
    return (
      <Alert className="mt-6 border-primary/30 bg-primary/5 text-center">
        <MessageSquare className="h-5 w-5 text-primary mx-auto mb-2" />
        <AlertTitle className="text-primary/90 font-semibold">Statement Submitted</AlertTitle>
        <AlertDescription className="text-foreground/80">
          You have already shared your perspective on this topic. Thank you for your contribution!
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
                  placeholder={
                    !user 
                      ? "Please sign in to contribute to the debate." 
                      : !kycVerified
                      ? "Please verify your identity to participate."
                      : "Share your main argument or perspective on this topic..."
                  }
                  className="resize-none min-h-[120px]"
                  rows={5}
                  {...field}
                  disabled={loading || !user || !kycVerified || hasPostedStatement || authLoading || isCheckingStatus}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="mt-4 w-full sm:w-auto" 
          disabled={loading || !user || !kycVerified || hasPostedStatement || authLoading || isCheckingStatus}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit Statement
        </Button>
        
        {!user && (
           <p className="mt-2 text-xs text-destructive">
            <Button variant="link" className="p-0 text-destructive hover:text-destructive/80 h-auto" onClick={() => {
                 const currentPath = window.location.pathname + window.location.search;
                 router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
            }}>Sign in</Button> to participate.
          </p>
        )}
        {user && !kycVerified && (
          <p className="mt-2 text-xs text-destructive">
            You need to <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link> to participate in debates.
          </p>
        )}
        </div>
      </form>
    </Form>
  );
}
