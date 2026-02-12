
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { createThreadNode, getUserQuestionCountForStatement } from "@/lib/client/threads";
import type { ThreadNode } from "@/types";
import Link from "next/link"; 
import { logger } from '@/lib/logger';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToastAction } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from '@/lib/http/client';

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
  const [aiDrafting, setAiDrafting] = React.useState(false);
  const [composerAiAssisted, setComposerAiAssisted] = React.useState(false);

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
          logger.error("Failed to fetch user question count for statement:", statementId, error);
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
        description: "Your account is currently restricted. Please complete personhood verification to participate in threads.",
        variant: "destructive",
        duration: 7000,
      });
      router.push('/account-suspended');
      return;
    }

    if (type === 'question' && currentUserQuestionCount >= 3) {
      toast({ title: "Question Limit Reached", description: "You have already asked 3 questions in this statement's thread.", variant: "destructive" });
      return;
    }
    // Do not allow authors to ask questions on their own statements
    if (type === 'question' && user.uid === statementAuthorId) {
      toast({ title: 'Not Allowed', description: 'Authors cannot ask questions on their own statements.', variant: 'destructive' });
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
        aiAssisted: !!composerAiAssisted,
      });
      toast({ title: `${type === 'question' ? 'Question' : 'Response'} Submitted!`, description: "Your contribution has been added." });
      form.reset();
      setComposerAiAssisted(false);
      onSuccess(); 
    } catch (error: any) {
      logger.error(`Error submitting thread node (type: ${type}):`, error);
      const code = error?.code as string | undefined;
      const map: Record<string, { title: string; description: string }> = {
        limit: { title: 'Limit Reached', description: 'You have asked 3 questions for this statement.' },
        forbidden: { title: 'Not Allowed', description: 'Only the statement author can respond.' },
        kyc_required: { title: 'Verification Required', description: 'Please verify personhood or wait for the grace period.' },
        appcheck: { title: 'Security Check Failed', description: 'App integrity verification failed. Refresh and try again.' },
        unauthorized: { title: 'Authentication Required', description: 'Please sign in again and retry.' },
        toxicity: { title: 'Content Blocked for Civility', description: 'Please rephrase to keep it respectful.' },
        rate_limited: { title: 'Too Many Requests', description: 'You are posting too quickly. Please wait and try again.' },
      };
      const m = (code && map[code]) || {
        title: `Failed to Submit ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        description: 'Please try again.',
      };
      if (code === 'toxicity') {
        const url = `/appeals?topicId=${encodeURIComponent(topicId)}&statementId=${encodeURIComponent(statementId)}&reason=${encodeURIComponent('My post was blocked by the civility filter. Please review.')}`;
        toast({
          title: m.title,
          description: m.description,
          variant: 'destructive',
          action: (
            <ToastAction altText="Appeal" onClick={() => router.push(url)}>
              Appeal this decision
            </ToastAction>
          ),
        });
      } else {
        toast({ title: m.title, description: m.description, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const defaultPlaceholder = type === 'question' 
    ? "Every question sharpens the truth. Ask away." 
    : "Provide your response...";
  const defaultSubmitText = type === 'question' ? "Ask away" : "Post Response";

  const isDisabled = isSubmitting || authLoading || isLoadingQuestionCount || (type === 'question' && currentUserQuestionCount >= 3) || isSuspended;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2 py-3 px-1 border-t border-dashed border-white/10">
        {!authLoading && !user && (
          <Alert className="mb-2 border-primary/30 bg-primary/10 text-left">
            <AlertTitle className="text-primary font-semibold flex items-center">
              <Lock className="h-4 w-4 mr-2" /> Sign in to join the thread
            </AlertTitle>
            <AlertDescription className="text-white/80">
              You can read everything, but to ask questions or respond please
              <Button variant="link" className="p-0 h-auto text-primary underline hover:text-white transition ml-1" onClick={() => router.push(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>Be a dbaitr</Button>.
            </AlertDescription>
          </Alert>
        )}
        {user && isSuspended && (
          <Alert className="mb-2 border-yellow-500/30 bg-yellow-500/10 text-left">
            <AlertTitle className="text-yellow-300 font-semibold flex items-center">
              <Lock className="h-4 w-4 mr-2" /> Account restricted — verify to participate
            </AlertTitle>
            <AlertDescription className="text-white/80">
              Your personhood verification deadline has expired. Please
              <Button asChild variant="link" className="p-0 h-auto text-yellow-300 underline hover:text-white transition ml-1">
                <Link href="/verify-identity">verify personhood</Link>
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
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">{type === 'question' ? 'Your Question' : 'Your Response'}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={placeholderText || defaultPlaceholder}
                  className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition min-h-[80px] resize-none text-sm"
                  rows={3}
                  {...field}
                  disabled={isDisabled || !user} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {user && !isSuspended && (
          <div className="-mt-1 mb-1 flex items-center gap-2 text-xs text-white/60">
            <button
              type="button"
              className="underline hover:text-white disabled:opacity-60"
              onClick={async () => {
                if (!user) return;
                try {
                  setAiDrafting(true);
                  const token = await user.getIdToken();
                  const res = await apiFetch('/api/ai/draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      type,
                      context: type === 'response' ? 'Reply concisely and respectfully to a question in this debate thread.' : 'Ask a concise, respectful question that seeks clarification.',
                    }),
                  });
                  const j = await res.json();
                  if (j?.ok && j?.text) {
                    form.setValue('content', j.text, { shouldValidate: true });
                    setComposerAiAssisted(true);
                  }
                } catch {}
                finally { setAiDrafting(false); }
              }}
              disabled={aiDrafting || isDisabled}
            >
              {aiDrafting ? 'Drafting…' : 'Draft with AI'}
            </button>
            {composerAiAssisted && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-emerald-300 cursor-help">AI-assisted</span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs">
                    <p>This draft was generated with AI. Edit before posting.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
        <div className="flex justify-end items-center gap-2">
            {type === 'question' && !isLoadingQuestionCount && user && !isSuspended &&(
                 <p className="text-xs text-white/50">
                    Questions asked for this statement: {currentUserQuestionCount}/3
                </p>
            )}
            {(isLoadingQuestionCount && type === 'question') && ( 
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            )}
          <Button 
            type="submit" 
            size="sm" 
            className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold shadow-lg shadow-black/20 transition"
            disabled={isDisabled || !user}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              (!user || isSuspended) ? <Lock className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />
            )}
            {submitButtonText || defaultSubmitText}
          </Button>
        </div>
         {!authLoading && !user && (
            <p className="text-xs text-rose-400 text-right">
                Please <Button variant="link" className="p-0 h-auto text-rose-400 underline hover:text-white transition" onClick={() => router.push(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>sign in</Button> to participate.
            </p>
        )}
        {!authLoading && user && !kycVerified && !isSuspended &&(
            <p className="text-xs text-rose-400 text-right">
                Please <Link href="/verify-identity" className="text-rose-400 underline hover:text-white transition">verify personhood</Link> to participate (10-day grace period).
            </p>
        )}
        {!authLoading && user && isSuspended && (
             <p className="text-xs text-rose-400 text-right">
                Your account is suspended. Please <Link href="/verify-identity" className="text-rose-400 underline hover:text-white transition">verify personhood</Link>.
            </p>
        )}
      </form>
    </Form>
  );
}
