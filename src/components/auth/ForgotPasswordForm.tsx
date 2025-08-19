
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { logger } from '@/lib/logger';
import { useFormEnterSubmit, focusById } from '@/hooks/useFormEnterSubmit';

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  React.useEffect(() => {
    focusById('forgot-email-input');
  }, []);

  async function onSubmit(values: ForgotPasswordFormValues) {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: "Password Reset Email Sent",
        description: "If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).",
        duration: 7000,
      });
      // Optionally redirect or clear form
      // router.push("/auth"); 
    } catch (error: any) {
      logger.error("Detailed error: Password reset request failed:", error);
      // Avoid disclosing whether an email exists or not for security reasons.
      // The message above is generic enough.
      // If more specific Firebase errors need to be handled, they can be added here.
      toast({
        title: "Request Failed",
        description: "There was an issue processing your request. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const enterSubmit = useFormEnterSubmit(form.handleSubmit, onSubmit);

  return (
    <Form {...form}>
      <form onKeyDown={enterSubmit} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Email Address</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
                  <Input 
                    placeholder="you@example.com" 
                    {...field} 
                    id="forgot-email-input"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Reset Link
        </Button>
        <p className="text-center text-sm text-white/50">
          Remember your password?{" "}
          <Button variant="link" asChild className="p-0 text-rose-400 underline hover:text-white transition h-auto">
            <Link href="/auth">Sign In / Sign Up</Link>
          </Button>
        </p>
      </form>
    </Form>
  );
}
