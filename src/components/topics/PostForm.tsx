
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, MessageSquare, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { createStatement, checkIfUserHasPostedStatement } from "@/lib/client/statements";
import type { Topic } from "@/types";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { logger } from '@/lib/logger';


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
  const { user, userProfile, kycVerified, loading: authLoading, isSuspended } = useAuth();
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
          logger.error(`Detailed error: Could not check if user ${user.uid} has posted a statement for topic ${topic.id}:`, error);
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
        setHasPostedStatement(false); 
      }
    }
    if (!authLoading) { 
      checkStatementStatus();
    }
  }, [user, topic.id, authLoading, toast]);


  async function onSubmit(values: StatementFormValues) {
    if (authLoading) { 
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
      router.push(`/auth?returnTo=${encodeURIComponent(currentPath)}`); 
      return;
    }

    if (isSuspended) {
      toast({
        title: "Account Access Restricted",
        description: "Your account is currently restricted. Please complete your identity verification to post statements.",
        variant: "destructive",
        duration: 7000,
      });
      router.push('/account-suspended');
      return;
    }

    // Unverified users can still post until the deadline; blocked only when suspended.
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
      logger.error("Detailed error: Failed to create statement. Values:", values, "Topic ID:", topic.id, "Error:", error);
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
      <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/10 mt-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
        <p className="ml-2 text-white/50">Loading your statement status...</p>
      </div>
    );
  }

  if (hasPostedStatement) {
    return (
      <Alert className="mt-6 border-rose-500/30 bg-rose-500/5 text-center">
        <MessageSquare className="h-5 w-5 text-rose-400 mx-auto mb-2" />
        <AlertTitle className="text-rose-300 font-semibold">Statement Submitted</AlertTitle>
        <AlertDescription className="text-white/80">
          You have already shared your perspective on this topic. Thank you for your contribution!
        </AlertDescription>
      </Alert>
    );
  }
  
  if (isSuspended) {
     return (
      <Alert variant="destructive" className="mt-6 text-center bg-red-900/30 border-red-700 text-red-300">
        <AlertTitle className="text-white font-semibold">Account Access Restricted</AlertTitle>
        <AlertDescription className="text-red-300">
          Your account is currently restricted. Please{' '}
          <Link href="/verify-identity" className="text-rose-400 underline hover:text-white transition">
            complete your identity verification
          </Link>{' '}
          to post statements.
        </AlertDescription>
      </Alert>
    );
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/10 mt-6">
        {!authLoading && !user && (
          <Alert className="mb-2 border-primary/30 bg-primary/10 text-left">
            <AlertTitle className="text-primary font-semibold flex items-center">
              <Lock className="h-4 w-4 mr-2" /> Sign in to post your truth
            </AlertTitle>
            <AlertDescription className="text-white/80">
              You can read everything, but to post a statement please
              <Button variant="link" className="p-0 h-auto text-primary underline hover:text-white transition ml-1" onClick={() => {
                const currentPath = window.location.pathname + window.location.search;
                router.push(`/auth?returnTo=${encodeURIComponent(currentPath)}`);
              }}>Be a dbaitr</Button>.
            </AlertDescription>
          </Alert>
        )}
        {user && isSuspended && (
          <Alert className="mb-2 border-yellow-500/30 bg-yellow-500/10 text-left">
            <AlertTitle className="text-yellow-300 font-semibold flex items-center">
              <Lock className="h-4 w-4 mr-2" /> Account restricted — verify to post
            </AlertTitle>
            <AlertDescription className="text-white/80">
              Your identity verification deadline has expired. Please
              <Button asChild variant="link" className="p-0 h-auto text-yellow-300 underline hover:text-white transition ml-1">
                <Link href="/verify-identity">verify your identity</Link>
              </Button>
              to unlock posting.
            </AlertDescription>
            <div className="mt-2">
              <Button asChild size="sm" variant="outline" className="border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20 hover:text-yellow-200">
                <Link href="/verify-identity">Verify now</Link>
              </Button>
            </div>
          </Alert>
        )}
        <div>
        <FormLabel className="text-lg font-semibold mb-2 block text-white">Your Statement</FormLabel>
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
                      ? "Please verify your identity to participate (10-day grace period applies)."
                      : "Share your main argument or perspective on this topic..."
                  }
                  className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition min-h-[120px] resize-none"
                  rows={5}
                  {...field}
                  disabled={loading || !user || hasPostedStatement || authLoading || isCheckingStatus || isSuspended}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="mt-4 w-full sm:w-auto px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" 
          disabled={loading || !user || hasPostedStatement || authLoading || isCheckingStatus || isSuspended}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            (!user || isSuspended) ? <Lock className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />
          )}
          Post your truth
        </Button>
        
        {!user && !authLoading && null}
        {user && !kycVerified && !authLoading && !isSuspended && ( 
          <p className="mt-2 text-xs text-rose-400">
            You need to <Link href="/verify-identity" className="text-rose-400 underline hover:text-white transition">verify your ID</Link> to participate (10-day grace period).
          </p>
        )}
        </div>
      </form>
    </Form>
  );
}
