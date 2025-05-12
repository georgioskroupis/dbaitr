
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
  statementAuthorId: string;
  parentId: string | null;
  type: 'question' | 'response';
  onSuccess: () => void; // Callback to refresh thread list
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
  const { user, kycVerified, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [questionCount, setQuestionCount] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(type === 'question');

  const form = useForm<ThreadFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function fetchQuestionCount() {
      if (user && type === 'question') {
        setIsLoadingQuestionCount(true);
        try {
          const count = await getUserQuestionCountForStatement(user.uid, statementId, topicId);
          setQuestionCount(count);
        } catch (error) {
          console.error("Failed to fetch user question count:", error);
          toast({ title: "Error", description: "Could not verify your question limit.", variant: "destructive" });
        } finally {
          setIsLoadingQuestionCount(false);
        }
      } else {
        setIsLoadingQuestionCount(false);
      }
    }
    if (!authLoading) {
        fetchQuestionCount();
    }
  }, [user, type, statementId, topicId, authLoading, toast]);


  async function onSubmit(values: ThreadFormValues) {
    if (authLoading || isLoadingQuestionCount) {
      toast({ title: "Please wait", description: "Verifying conditions...", variant: "default" });
      return;
    }

    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to post.", variant: "destructive" });
      router.push(`/sign-in?redirect=${window.location.pathname}`);
      return;
    }
    if (!kycVerified) {
      toast({ title: "Identity Verification Required", description: "Please verify your ID to post.", variant: "destructive" });
      router.push('/verify-identity');
      return;
    }

    if (type === 'question' && questionCount >= 3) {
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
      if (type === 'question') setQuestionCount(prev => prev + 1);
      onSuccess();
    } catch (error: any) {
      console.error(`Error submitting thread node (type: ${type}):`, error);
      toast({
        title: `Failed to Submit ${type === 'question' ? 'Question' : 'Response'}`,
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

  const isDisabled = isSubmitting || authLoading || isLoadingQuestionCount || (type === 'question' && questionCount >= 3);

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
                  disabled={isDisabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end items-center gap-2">
            {type === 'question' && !isLoadingQuestionCount && (
                 <p className="text-xs text-muted-foreground">
                    Questions asked: {questionCount}/3
                </p>
            )}
            {(isLoadingQuestionCount || authLoading) && type === 'question' && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          <Button type="submit" size="sm" disabled={isDisabled}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitButtonText || defaultSubmitText}
          </Button>
        </div>
      </form>
    </Form>
  );
}
