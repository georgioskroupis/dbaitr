
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type AuthError,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { createUserProfile } from "@/lib/firestoreActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, KeyRound, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

const loginSchema = z.object({
  email: z.string().email(), // Already validated
  password: z.string().min(1, { message: "Password cannot be empty." }),
});

const signupSchema = z.object({
  email: z.string().email(), // Already validated
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }).max(50, "Full name must be at most 50 characters."),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

type AuthPhase = "email" | "login" | "signup";

export default function UnifiedAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [phase, setPhase] = React.useState<AuthPhase>("email");
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", fullName: "", password: "" },
  });

  const handleEmailSubmit: SubmitHandler<EmailFormValues> = async (values) => {
    setIsLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, values.email);
      setEmail(values.email); 
      loginForm.setValue("email", values.email); 
      signupForm.setValue("email", values.email); 

      if (methods.length > 0) {
        setPhase("login");
      } else {
        setPhase("signup");
      }
    } catch (error) {
      console.error("Error checking email:", error);
      toast({
        title: "Error",
        description: "Could not check email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit: SubmitHandler<LoginFormValues> = async (values) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await createUserProfile(
          userCredential.user.uid,
          userCredential.user.email,
          userCredential.user.displayName,
          userCredential.user.providerData[0]?.providerId || 'password'
        );
      }
      toast({ title: "Signed in successfully!" });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({
        title: "Sign In Failed",
        description: authError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit: SubmitHandler<SignupFormValues> = async (values) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: values.fullName });
        await createUserProfile(
          userCredential.user.uid,
          values.email,
          values.fullName,
          'password' // Assuming email/password signup
        );
      }
      toast({ 
        title: "Account Created Successfully!",
        description: "Please verify your identity within 10 days to maintain full access.",
        duration: 7000,
      });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/dashboard"); // Redirect to dashboard or returnTo URL
    } catch (error) {
      const authError = error as AuthError;
      console.error("Sign up error:", authError);
      toast({
        title: "Sign Up Failed",
        description: authError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormContent = () => {
    if (phase === "email") {
      return (
        <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="email-input" className="text-xl font-semibold text-foreground">Who are you?</Label>
            <p className="text-sm text-muted-foreground mb-4">Enter your email to continue.</p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email-input"
                type="email"
                placeholder="you@example.com"
                className="pl-10 text-base"
                {...emailForm.register("email")}
              />
            </div>
            {emailForm.formState.errors.email && (
              <p className="mt-2 text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full text-base py-3" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Continue"}
          </Button>
        </form>
      );
    }

    if (phase === "login") {
      return (
        <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome Back</h2>
          <p className="text-sm text-muted-foreground">
            Logging in as <span className="font-medium text-primary">{email}</span>.
            Not you? <Button variant="link" className="p-0 h-auto text-sm" onClick={() => { setPhase("email"); emailForm.reset(); loginForm.reset(); signupForm.reset();}}>Start Over</Button>
          </p>
          <div>
            <Label htmlFor="login-password">Password</Label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10"
                {...loginForm.register("password")}
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
            {loginForm.formState.errors.password && (
              <p className="mt-2 text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
          <div className="text-center">
             <Button variant="link" asChild className="p-0 text-sm text-muted-foreground hover:text-primary">
                <a href="/forgot-password">Forgot Password?</a>
              </Button>
          </div>
        </form>
      );
    }

    if (phase === "signup") {
      return (
        <form onSubmit={signupForm.handleSubmit(handleSignUpSubmit)} className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Create Your Account</h2>
           <p className="text-sm text-muted-foreground">
            Signing up with <span className="font-medium text-primary">{email}</span>.
            Already have an account? <Button variant="link" className="p-0 h-auto text-sm" onClick={() => setPhase("login")}>Sign In</Button>
          </p>
          <div>
            <Label htmlFor="signup-fullName">Full Name</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-fullName"
                placeholder="Your Full Name"
                className="pl-10"
                {...signupForm.register("fullName")}
              />
            </div>
            {signupForm.formState.errors.fullName && (
              <p className="mt-2 text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="•••••••• (min. 6 characters)"
                className="pl-10"
                {...signupForm.register("password")}
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
            {signupForm.formState.errors.password && (
              <p className="mt-2 text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account & Get Certified"}
          </Button>
        </form>
      );
    }
    return null;
  };

  return (
    <>
      {renderFormContent()}
    </>
  );
}
