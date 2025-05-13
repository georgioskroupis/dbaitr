
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Eye, EyeOff, Loader2, User, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { auth } from "@/lib/firebase/config";
import { createUserProfile } from "@/lib/firestoreActions";


const formSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters."}).max(50, { message: "Full name must be at most 50 characters."}), 
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type SignUpFormValues = z.infer<typeof formSchema>;

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "", 
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignUpFormValues) {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      
      // Update Firebase Auth profile displayName
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: values.fullName });
      }
      
      // Create user profile in Firestore
      if (userCredential.user) {
        await createUserProfile(
          userCredential.user.uid, 
          values.email, 
          values.fullName, // Pass fullName from form
          'password' // Provider for email/password sign-up
        );
      }

      toast({ title: "Account created successfully!" });
      
      const returnTo = searchParams.get('returnTo');
      if (returnTo) {
        router.push(decodeURIComponent(returnTo));
      } else {
        router.push("/verify-identity"); // Default redirect after sign-up
      }
    } catch (error: any) {
      console.error("Detailed error: Account creation failed:", error);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use by another account. Please try a different email or sign in.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak. Please choose a stronger password (at least 6 characters).';
            break;
          case 'auth/network-request-failed':
            errorMessage = "A network error occurred. Please check your internet connection and try again.";
            break;
          default:
            errorMessage = `Sign up failed: ${error.message || 'Unknown error.'}`;
        }
      }
      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName" 
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel> 
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Your Full Name" {...field} className="pl-10" /> 
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="you@example.com" {...field} className="pl-10" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                 <div className="relative">
                   <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="•••••••• (min. 6 characters)" 
                    {...field} 
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button variant="link" asChild className="p-0 text-primary">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </p>
      </form>
    </Form>
  );
}
