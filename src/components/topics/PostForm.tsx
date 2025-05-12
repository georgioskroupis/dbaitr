
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
import { createStatement, checkIfUserHasPostedStatement } from "@/lib/firestoreActions"; // Renamed
import type { Topic } from "@/types";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const formSchema = z.object({
  content: z.string().min(10, "Statement must be at least 10 characters.").max(2000, "Statement must be at most 2000 characters."), // Changed from Post
});

type StatementFormValues = z.infer<typeof formSchema>; // Changed from PostFormValues

interface StatementFormProps { // Changed from PostFormProps
  topic: Topic;
  onStatementCreated?: () => void; // Changed from onPostCreated
}

export function PostForm({ topic, onStatementCreated }: StatementFormProps) { // Component name kept PostForm for now to avoid renaming the file in this step
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, kycVerified, loading: authLoading } = useAuth(); // Changed isVerified to kycVerified
  const [loading, setLoading] = React.useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = React.useState(true); // Renamed
  const [hasPostedStatement, setHasPostedStatement] = React.useState(false); // Renamed

  const form = useForm<StatementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: "" },
  });

  React.useEffect(() => {
    async function checkStatementStatus() { // Renamed
      if (user && topic.id) {
        setIsCheckingStatus(true);
        try {
          const hasPosted = await checkIfUserHasPostedStatement(user.uid, topic.id); // Renamed
          setHasPostedStatement(hasPosted);
        } catch (error) {
          console.error(`Detailed error: Could not check if user ${user.uid} has posted a statement for topic ${topic.id}:`, error);
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
  }, [user, topic.id, authLoading]);


  async function onSubmit(values: StatementFormValues) {
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
    if (!kycVerified) { // Changed isVerified to kycVerified
      toast({ 
        title: "Identity Verification Required", 
        description: "To maintain a fair and accountable debate space, please verify your ID before posting. You will be redirected to the verification page.", 
        variant: "destructive" 
      });
      router.push('/verify-identity'); 
      return;
    }
    if (hasPostedStatement) {
      toast({ 
        title: "Statement Already Submitted", // Renamed
        description: "You have already submitted your statement for this debate topic. Further interactions (like replies or Q&A) will be available in future updates.", 
        variant: "default" 
      });
      return;
    }

    setLoading(true);
    try {
      // createStatement now handles AI classification and topic score updates.
      // userName and userPhotoURL are not passed directly as they are not in Statement schema;
      // they can be fetched using createdBy (user.uid).
      await createStatement(
        topic.id, 
        user.uid, 
        values.content
        // userProfile.fullName, // Not passed directly
        // userProfile.photoURL, // Not passed directly
      );
      
      toast({ title: "Statement Submitted Successfully!", description: "Your contribution has been added to the debate." }); // Updated message
      form.reset(); 
      setHasPostedStatement(true); 
      if (onStatementCreated) onStatementCreated();
    } catch (error: any) {
      console.error("Detailed error: Failed to create statement. Values:", values, "Topic ID:", topic.id, "Error:", error);
      toast({ 
        title: "Failed to Submit Statement", // Renamed
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
        <p className="ml-2 text-muted-foreground">Loading your statement status...</p> {/* Renamed */}
      </div>
    );
  }

  if (hasPostedStatement) {
    return (
      <Alert className="mt-6 border-primary/30 bg-primary/5 text-center">
        <MessageSquare className="h-5 w-5 text-primary mx-auto mb-2" />
        <AlertTitle className="text-primary/90 font-semibold">Statement Submitted</AlertTitle> {/* Renamed */}
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
                      : !kycVerified // Changed
                      ? "Please verify your identity to participate."
                      : "Share your main argument or perspective on this topic..."
                  }
                  className="resize-none min-h-[120px]"
                  rows={5}
                  {...field}
                  disabled={loading || !user || !kycVerified || hasPostedStatement || authLoading || isCheckingStatus} // Changed
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="mt-4 w-full sm:w-auto" 
          disabled={loading || !user || !kycVerified || hasPostedStatement || authLoading || isCheckingStatus} // Changed
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit Statement {/* Renamed */}
        </Button>
        
        {!user && (
           <p className="mt-2 text-xs text-destructive">
            <Button variant="link" className="p-0 text-destructive hover:text-destructive/80 h-auto" onClick={() => {
                 const currentPath = window.location.pathname + window.location.search;
                 router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
            }}>Sign in</Button> to participate.
          </p>
        )}
        {user && !kycVerified && ( // Changed
          <p className="mt-2 text-xs text-destructive">
            You need to <Link href="/verify-identity" className="underline hover:text-destructive/80">verify your ID</Link> to participate in debates.
          </p>
        )}
        </div>
      </form>
    </Form>
  );
}
