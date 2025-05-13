
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { createThreadNode, getUserQuestionCountForStatement } from "@/lib/firestoreActions";
import type { ThreadNode } from "@/types";
import Link from "next/link"; // Import Link for KYC message

const formSchema = z.object({
  content: z.string().min(5, "Content must be at least 5 characters.").max(1000, "Content must be at most 1000 characters."),
});

type ThreadFormValues = z.infer<typeof formSchema>;

interface ThreadPostFormProps {
  topicId: string;
  statementId: string;
  statementAuthorId: string; 
  parentId: string | null;    
  type: 'question' | 'response'; 
  onSuccess: () => void; 
  placeholderText?: string;
  submitButtonText?: string;
}

export function ThreadPostForm({ 
  topicId, 
  statementId, 
  statementAuthorId, 
  parentId, 
  type, 
  onSuccess,
  placeholderText,
  submitButtonText
}: ThreadPostFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, kycVerified, loading: authLoading, isSuspended } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentUserQuestionCount, setCurrentUserQuestionCount] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(type === 'question');

  const form = useForm<ThreadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function fetchQuestionCount() {
      if (user && !authLoading) { 
        setIsLoadingQuestionCount(true);
        try {
          const count = await getUserQuestionCountForStatement(user.uid, statementId, topicId);
          setCurrentUserQuestionCount(count);
        } catch (error) {
          console.error("Failed to fetch user question count for statement:", statementId, error);
          toast({ title: "Error", description: "Could not verify your question limit for this statement.", variant: "destructive" });
        } finally {
          setIsLoadingQuestionCount(false);
        }
      } else if (!authLoading && !user) {
        setIsLoadingQuestionCount(false);
        setCurrentUserQuestionCount(0);
      }
    }
    fetchQuestionCount();
  }, [user, statementId, topicId, authLoading, toast]);


  async function onSubmit(values: ThreadFormValues) {
    if (authLoading || isLoadingQuestionCount) {
      toast({ title: "Please wait", description: "Verifying conditions...", variant: "default" });
      return;
    }

    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to post.", variant: "destructive" });
      router.push(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); 
      return;
    }

    if (isSuspended) {
      toast({
        title: "Account Access Restricted",
        description: "Your account is currently restricted. Please complete your identity verification to participate in threads.",
        variant: "destructive",
        duration: 7000,
      });
      router.push('/account-suspended');
      return;
    }

    if (!kycVerified) {
      toast({ 
        title: "Identity Verification Required", 
        description: "Please verify your ID to post in threads (10-day grace period applies).", 
        variant: "destructive",
        duration: 7000 
      });
      router.push('/verify-identity');
      return;
    }

    if (type === 'question' && currentUserQuestionCount >= 3) {
      toast({ title: "Question Limit Reached", description: "You have already asked 3 questions in this statement's thread.", variant: "destructive" });
      return;
    }
    
    if (type === 'response' && user.uid !== statementAuthorId) {
      toast({ title: "Permission Denied", description: "Only the statement author can reply directly to questions.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await createThreadNode({
        topicId,
        statementId,
        statementAuthorId, 
        parentId,
        content: values.content,
        createdBy: user.uid,
        type, 
      });
      toast({ title: `${type === 'question' ? 'Question' : 'Response'} Submitted!`, description: "Your contribution has been added." });
      form.reset();
      onSuccess(); 
    } catch (error: any) {
      console.error(`Error submitting thread node (type: ${type}):`, error);
      toast({
        title: `Failed to Submit ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const defaultPlaceholder = type === 'question' 
    ? "Ask a clarifying question or challenge a point..." 
    : "Provide your response...";
  const defaultSubmitText = type === 'question' ? "Ask Question" : "Post Response";

  const isDisabled = isSubmitting || authLoading || isLoadingQuestionCount || (type === 'question' && currentUserQuestionCount >= 3) || isSuspended;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2 py-3 px-1 border-t border-dashed">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">{type === 'question' ? 'Your Question' : 'Your Response'}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={placeholderText || defaultPlaceholder}
                  className="resize-none min-h-[80px] text-sm"
                  rows={3}
                  {...field}
                  disabled={isDisabled || !user || !kycVerified} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end items-center gap-2">
            {type === 'question' && !isLoadingQuestionCount && user && kycVerified && !isSuspended &&(
                 <p className="text-xs text-muted-foreground">
                    Questions asked for this statement: {currentUserQuestionCount}/3
                </p>
            )}
            {(isLoadingQuestionCount && type === 'question') && ( 
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          <Button 
            type="submit" 
            size="sm" 
            disabled={isDisabled || !user || !kycVerified}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {submitButtonText || defaultSubmitText}
          </Button>
        </div>
         {!authLoading && !user && (
            <p className="text-xs text-destructive text-right">
                Please <Button variant="link" className="p-0 h-auto text-destructive hover:text-destructive/80" onClick={() => router.push(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>sign in</Button> to participate.
            </p>
        )}
        {!authLoading && user && !kycVerified && !isSuspended &&(
            <p className="text-xs text-destructive text-right">
                Please <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link> to participate (10-day grace period).
            </p>
        )}
        {!authLoading && user && isSuspended && (
             <p className="text-xs text-destructive text-right">
                Your account is suspended. Please <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link>.
            </p>
        )}
      </form>
    </Form>
  );
}
