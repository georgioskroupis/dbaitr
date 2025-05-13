
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

const formSchema = z.object({
  content: z.string().min(5, "Content must be at least 5 characters.").max(1000, "Content must be at most 1000 characters."),
});

type ThreadFormValues = z.infer<typeof formSchema>;

interface ThreadPostFormProps {
  topicId: string;
  statementId: string;
  statementAuthorId: string; // UID of the author of the root statement
  parentId: string | null;    // ID of parent ThreadNode, or null if root question for statement
  type: 'question' | 'response'; // Type of node THIS FORM WILL CREATE
  onSuccess: () => void; 
  placeholderText?: string;
  submitButtonText?: string;
}

export function ThreadPostForm({ 
  topicId, 
  statementId, 
  statementAuthorId, 
  parentId, 
  type, // This is the type of node being created
  onSuccess,
  placeholderText,
  submitButtonText
}: ThreadPostFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, kycVerified, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // This count is for the user's questions on the current statement's overall thread
  const [currentUserQuestionCount, setCurrentUserQuestionCount] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(type === 'question');

  const form = useForm<ThreadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function fetchQuestionCount() {
      if (user && !authLoading) { // Only fetch if user is loaded
        // Always fetch, as it's used to disable "Ask Question" even if this form is for a "response"
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
      router.push(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); // Updated redirect
      return;
    }
    if (!kycVerified) {
      toast({ title: "Identity Verification Required", description: "Please verify your ID to post.", variant: "destructive" });
      router.push('/verify-identity');
      return;
    }

    // Specific checks based on the type of node being created
    if (type === 'question' && currentUserQuestionCount >= 3) {
      toast({ title: "Question Limit Reached", description: "You have already asked 3 questions in this statement's thread.", variant: "destructive" });
      return;
    }
    
    if (type === 'response' && user.uid !== statementAuthorId) {
      toast({ title: "Permission Denied", description: "Only the statement author can reply directly to questions.", variant: "destructive" });
      return;
    }
    // Server-side will also check if the parent question (if type is 'response') already has a response.

    setIsSubmitting(true);
    try {
      await createThreadNode({
        topicId,
        statementId,
        statementAuthorId, // Pass this for server-side check if type is 'response'
        parentId,
        content: values.content,
        createdBy: user.uid,
        type, // The type of node being created
      });
      toast({ title: `${type === 'question' ? 'Question' : 'Response'} Submitted!`, description: "Your contribution has been added." });
      form.reset();
      // No need to update currentUserQuestionCount here, onSuccess will trigger parent re-fetch
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

  const isDisabled = isSubmitting || authLoading || isLoadingQuestionCount || (type === 'question' && currentUserQuestionCount >= 3);

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
                  disabled={isDisabled || !user || !kycVerified} // Also disable if no user/kyc
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end items-center gap-2">
            {type === 'question' && !isLoadingQuestionCount && user && kycVerified && (
                 <p className="text-xs text-muted-foreground">
                    Questions asked for this statement: {currentUserQuestionCount}/3
                </p>
            )}
            {(isLoadingQuestionCount && type === 'question') && ( // Show loader only when relevant for question count
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
        {!authLoading && user && !kycVerified && (
            <p className="text-xs text-destructive text-right">
                Please <Button variant="link" className="p-0 h-auto text-destructive hover:text-destructive/80" onClick={() => router.push('/verify-identity')}>verify your ID</Button> to participate.
            </p>
        )}
      </form>
    </Form>
  );
}
