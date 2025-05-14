
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
  onAuthStateChanged,
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
  email: z.string().email(),
  password: z.string().min(1, { message: "Password cannot be empty." }),
});

const signupSchema = z.object({
  email: z.string().email(),
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

  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const loginPasswordInputRef = React.useRef<HTMLInputElement>(null);
  const signupFullNameInputRef = React.useRef<HTMLInputElement>(null);


  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("🌀 Auth Phase changed:", phase);
    }
    // Auto-focus logic
    setTimeout(() => {
      if (phase === "email") {
        emailInputRef.current?.focus();
      } else if (phase === "login") {
        loginPasswordInputRef.current?.focus();
      } else if (phase === "signup") {
        signupFullNameInputRef.current?.focus();
      }
    }, 0); // setTimeout ensures focus happens after potential DOM updates
  }, [phase]);

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
    defaultValues: {
      email: "",
      fullName: "",
      password: ""
    },
    mode: "onChange", 
    criteriaMode: "all", 
    shouldFocusError: true, 
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
      if (process.env.NODE_ENV !== "production") {
        console.error("🔥 Full Auth Error:", error);
      }
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
    if (process.env.NODE_ENV !== "production") {
      console.log("🚨 Attempting login with:", values);
      console.log("🚀 Attempting to sign in with email:", values.email);
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      if (process.env.NODE_ENV !== "production") {
        console.log("✅ Sign in successful. Firebase User Credential:", userCredential);
        console.log("👤 Firebase currentUser after sign in:", auth.currentUser);
      }

      if (userCredential.user) {
        await createUserProfile(
          userCredential.user.uid,
          userCredential.user.email,
          userCredential.user.displayName,
          userCredential.user.providerData[0]?.providerId || 'password'
        );
      }

      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("User after login state stabilization:", auth.currentUser);
      }

      toast({ title: "Signed in successfully!" });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      if (process.env.NODE_ENV !== "production") {
        console.error("🔥 Full Auth Error:", error);
      }
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
    const isValid = await signupForm.trigger();
    if (!isValid) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }
  
    if (process.env.NODE_ENV !== "production") {
        console.log("🧾 Values before submit (from signupForm.getValues()):", signupForm.getValues());
        console.log("📨 Signup form submitted with (from submit handler 'values' arg):", values);
    }
    setIsLoading(true);
    if (process.env.NODE_ENV !== "production") {
      console.log("ℹ️ Starting sign-up process...");
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("🚀 Attempting to sign up with email:", values.email);
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (process.env.NODE_ENV !== "production") {
        console.log("✅ Sign up successful. Firebase User Credential:", userCredential);
      }

      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: values.fullName });
        await createUserProfile(
          userCredential.user.uid,
          values.email,
          values.fullName,
          'password'
        );
      }
      if (process.env.NODE_ENV !== "production") {
        console.log("🧾 Firebase current user immediately after signup:", auth.currentUser);
      }

      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
      });
      
      toast({
        title: "Account Created Successfully!",
        description: "Please verify your identity within 10 days to maintain full access.",
        duration: 7000,
      });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/verify-identity");
    } catch (error) {
      const authError = error as AuthError; 
      if (process.env.NODE_ENV !== "production") {
       console.error("🔥 Full Auth Error:", error);
      }

      if (authError.code === "auth/email-already-in-use") {
        toast({
          title: "Email Already Registered",
          description: "That email has already been used. Try signing in instead.",
          variant: "destructive",
        });
        setPhase("login");
        loginForm.setValue("email", values.email); 
        return;
      }

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
      if (process.env.NODE_ENV !== "production") {
        console.log("🧪 Rendering EMAIL form with values:", emailForm.getValues());
      }
      return (
        <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="email-input" className="text-xl font-semibold text-white">Who are you?</Label>
            <p className="text-sm text-white/50 mb-4">Enter your email to continue.</p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="email-input"
                type="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...emailForm.register("email")}
                ref={emailInputRef}
              />
            </div>
            {emailForm.formState.errors.email && (
              <p className="mt-2 text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full text-base py-3 px-5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Continue"}
          </Button>
        </form>
      );
    }

    if (phase === "login") {
      if (process.env.NODE_ENV !== "production") {
        console.log("🧪 Rendering LOGIN form with values:", loginForm.getValues());
      }
      return (
        <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Welcome Back</h2>
          <p className="text-sm text-white/50">
            Logging in as <span className="font-medium text-rose-400">{email}</span>.
            Not you? <Button variant="link" className="p-0 h-auto text-sm text-rose-400 underline hover:text-white transition" onClick={() => { setPhase("email"); emailForm.reset(); loginForm.reset(); signupForm.reset(); }}>Start Over</Button>
          </p>
          <div>
            <Label htmlFor="login-password text-white">Password</Label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="login-password"
                ref={loginPasswordInputRef}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...loginForm.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-white/60 hover:text-white"
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
          <Button type="submit" className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
          <div className="text-center">
            <Button variant="link" asChild className="p-0 text-sm text-rose-400 underline hover:text-white transition h-auto">
              <a href="/forgot-password">Forgot Password?</a>
            </Button>
          </div>
        </form>
      );
    }

    if (phase === "signup") {
      if (process.env.NODE_ENV !== "production") {
        console.log("🧪 Rendering SIGNUP form with values:", signupForm.getValues());
      }
      return (
        <form className="space-y-6"
          onKeyDown={(e) => { 
            if (e.key === "Enter") {
              // Only submit if form is valid to prevent premature submission or phase switch
              if (signupForm.formState.isValid) {
                signupForm.handleSubmit(handleSignUpSubmit)();
              } else {
                e.preventDefault(); // Prevent default form submission
                // Optionally, trigger validation display or a toast
                signupForm.trigger(); // Trigger validation to show errors
                toast({
                  title: "Incomplete Form",
                  description: "Please fill in all required fields correctly.",
                  variant: "destructive",
                });
              }
            }
          }}
          onSubmit={signupForm.handleSubmit(handleSignUpSubmit, (errors) => {
            if (process.env.NODE_ENV !== "production") {
                console.warn("❌ Signup form validation failed:", errors);
            }
            toast({
                title: "Missing Fields",
                description: "Please fill in all required fields correctly.",
                variant: "destructive",
            });
         })}
        >
          <h2 className="text-xl font-semibold text-white">Create Your Account</h2>
          <p className="text-sm text-white/50">
            Signing up with <span className="font-medium text-rose-400">{email}</span>.
            Already have an account? <Button variant="link" className="p-0 h-auto text-sm text-rose-400 underline hover:text-white transition" onClick={() => {
                loginForm.setValue("email", email); 
                setPhase("login");
            }}>Sign In</Button>
          </p>
          <div>
            <Label htmlFor="signup-fullName" className="text-white">Full Name</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="signup-fullName"
                placeholder="Your Full Name"
                className="w-full pl-10 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...signupForm.register("fullName")}
                ref={signupFullNameInputRef}
              />
            </div>
            {signupForm.formState.errors.fullName && (
              <p className="mt-2 text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="signup-password text-white">Password</Label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="•••••••• (min. 6 characters)"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...signupForm.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-white/60 hover:text-white"
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
          <Button type="submit" className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account & Get Certified"}
          </Button>
        </form>
      );
    }
    return null;
  };

  return (
    <div key={phase}>
      {renderFormContent()}
    </div>
  );
}
    
