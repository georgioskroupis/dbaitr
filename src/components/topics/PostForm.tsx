
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, MessageSquare, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
  claimType: z.enum(['opinion','experience','fact'], { required_error: 'Select a claim type' }),
  sourceUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
}).refine((data) => data.claimType !== 'fact' || (data.sourceUrl && data.sourceUrl.trim().length > 4), {
  path: ['sourceUrl'],
  message: 'Source URL is required for facts',
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
  const [aiDrafting, setAiDrafting] = React.useState(false);
  const [composerAiAssisted, setComposerAiAssisted] = React.useState(false);

  const form = useForm<StatementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "", claimType: 'opinion', sourceUrl: '' },
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

  // Auto-classify claim type as user types
  const classifyDebounceRef = React.useRef<number | undefined>(undefined);
  const [autoType, setAutoType] = React.useState<{ claimType: 'opinion'|'experience'|'fact'; confidence: number } | null>(null);
  React.useEffect(() => {
    if (!user) return;
    const text = form.watch('content');
    if (!text || text.trim().length < 10) { setAutoType(null); return; }
    if (classifyDebounceRef.current) window.clearTimeout(classifyDebounceRef.current);
    classifyDebounceRef.current = window.setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/statements/classify-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text, topic: topic.title }),
        });
        const json = await res.json();
        if (json?.ok && json?.claimType) {
          setAutoType({ claimType: json.claimType, confidence: json.confidence });
          form.setValue('claimType', json.claimType, { shouldValidate: true });
        }
      } catch {}
    }, 500);
    return () => { if (classifyDebounceRef.current) window.clearTimeout(classifyDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('content'), user]);


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
      const st = await createStatement(
        topic.id,
        user.uid,
        values.content,
        values.claimType,
        values.sourceUrl || undefined,
        composerAiAssisted
      );
      // Trigger server-side analysis (best-effort)
      try {
        const token = await user.getIdToken();
        await fetch('/api/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ target: 'statement', topicId: topic.id, statementId: st.id, text: values.content }),
        });
      } catch {}
      
      toast({ title: "Statement Submitted Successfully!", description: "Your contribution has been added to the debate." });
      // Fire-and-forget classification
      try {
        const token = await user.getIdToken();
        await fetch('/api/statements/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ topicId: topic.id, statementId: st.id, text: values.content }),
        });
      } catch {}
      form.reset(); 
      setHasPostedStatement(true); 
      if (onStatementCreated) onStatementCreated();
    } catch (error: any) {
      logger.error("Detailed error: Failed to create statement. Values:", values, "Topic ID:", topic.id, "Error:", error);
      const code = error?.code as string | undefined;
      const map: Record<string, { title: string; description: string }> = {
        kyc_required: {
          title: 'Verification Required',
          description: 'Please verify your ID or wait for the grace period to post.',
        },
        source_required: {
          title: 'Source Required',
          description: 'A source URL is required for factual claims.',
        },
        appcheck: {
          title: 'Security Check Failed',
          description: 'App integrity verification failed. Refresh and try again.',
        },
        unauthorized: {
          title: 'Authentication Required',
          description: 'Please sign in again and retry.',
        },
      };
      const m = (code && map[code]) || {
        title: 'Failed to Submit Statement',
        description: 'We could not submit your statement. Please try again.',
      };
      toast({ title: m.title, description: m.description, variant: 'destructive' });
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
        {/* Optional AI drafting */}
        {user && !isSuspended && (
          <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
            <button
              type="button"
              className="underline hover:text-white"
              onClick={async () => {
                try {
                  setAiDrafting(true);
                  const token = await user.getIdToken();
                  const res = await fetch('/api/ai/draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ topic: topic.title, type: 'statement' }),
                  });
                  const j = await res.json();
                  if (j?.ok && j?.text) {
                    form.setValue('content', j.text, { shouldValidate: true });
                    setComposerAiAssisted(true);
                  }
                } catch {}
                finally { setAiDrafting(false); }
              }}
              disabled={aiDrafting || loading}
            >
              {aiDrafting ? 'Drafting…' : 'Draft with AI'}
            </button>
            {composerAiAssisted && <span className="text-[10px] text-emerald-300">AI-assisted</span>}
          </div>
        )}
        {/* Auto-detected claim type */}
        <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
          <span className="text-white/60">Detected:</span>
          <span className="capitalize">{autoType?.claimType || form.watch('claimType')}</span>
          {autoType && (
            <span className="text-white/40 text-xs">({Math.round(autoType.confidence * 100)}%)</span>
          )}
        </div>

        {/* Source URL when fact */}
        {(autoType?.claimType || form.watch('claimType')) === 'fact' && (
          <FormField
            control={form.control}
            name="sourceUrl"
            render={({ field }) => (
              <FormItem className="mt-2">
                <FormLabel className="text-white/80">Source URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/source"
                    {...field}
                    className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                    disabled={loading || !user || hasPostedStatement || authLoading || isCheckingStatus || isSuspended}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
