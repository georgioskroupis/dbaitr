
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
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore"; // Firestore helpers only
import { getAuth, getDb } from "@/lib/firebase/client";
// Avoid importing server actions into client page
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, KeyRound, User, Eye, EyeOff, Apple, Chrome } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormEnterSubmit, focusById } from "@/hooks/useFormEnterSubmit";
import { logger } from '@/lib/logger';
import { apiFetch } from '@/lib/http/client';


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
  const [signInHints, setSignInHints] = React.useState<string[]>([]); // e.g., ['google.com','apple.com']

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
    mode: "onChange",
  });

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
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

  React.useEffect(() => {
    logger.debug("🌀 Auth Phase changed:", phase);
    // Auto-focus logic
    if (phase === "email") {
      focusById('email-input');
    } else if (phase === "login") {
      loginForm.setValue("email", email);
      focusById('login-password');
    } else if (phase === "signup") {
      signupForm.setValue("email", email);
      focusById('signup-fullName');
    }
  }, [phase, email, loginForm, signupForm]);


  const handleEmailSubmit: SubmitHandler<EmailFormValues> = async (values) => {
    setIsLoading(true);
    const emailValue = emailForm.getValues("email"); // Retrieve the current value directly

    // Sanitize and validate the email
    const sanitizedEmail = emailValue ? emailValue.trim().toLowerCase() : "";
    if (!sanitizedEmail) {
      setIsLoading(false);
      return; // Stop the process if email is empty after sanitization
    }
      

    setIsLoading(true);
    try {
      logger.debug("🔥 Auth instance project:", getAuth().app.options.projectId);
      logger.debug("📬 Email submitted:", sanitizedEmail);

      // Ask server (Admin SDK) whether the email exists; in dev, App Check header is optional per API handler
      // If it fails, fall back to client Auth methods
      let serverExists: boolean | null = null;
      try {
        const { getToken } = await import('firebase/app-check');
        const { getAppCheckInstance } = await import('@/lib/appCheckClient');
        const appCheckInstance = getAppCheckInstance();
        const tokenResult = appCheckInstance ? await getToken(appCheckInstance, /* forceRefresh */ true).catch(() => null) : null;
        const appCheckToken = tokenResult?.token;
        const res = await apiFetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: sanitizedEmail })
        });
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[auth] check-email status', res.status);
        }
        if (res.ok) {
          const j = await res.json();
          serverExists = !!(j?.ok && j.exists);
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[auth] check-email payload', j);
          }
        }
      } catch {}

      // Production: Fetch sign-in methods for hints and as a fallback signal
      let methods: string[] = [];
      try {
        methods = await fetchSignInMethodsForEmail(getAuth(), sanitizedEmail);
        setSignInHints(methods);
        if ((serverExists ?? (methods.length > 0)) && methods.length && !methods.includes('password')) {
          const provider = methods.includes('google.com') ? 'Google' : methods.includes('apple.com') ? 'Apple' : 'your original provider';
          toast({ title: 'Use your original sign-in method', description: `This email is registered with ${provider}. Use ${provider} to continue.` });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[auth] fetchSignInMethodsForEmail failed', e);
        }
      }

      setEmail(sanitizedEmail);
      // Decision logic with anti-enumeration tolerance:
      // - If Admin says true -> login
      // - Else if methods suggest existing providers -> login
      // - Else if inconclusive (admin false/null AND no methods) -> prefer login to avoid false negatives
      // - Else -> signup
      const inconclusive = (serverExists === null || serverExists === false) && methods.length === 0;
      const exists = serverExists === true || methods.length > 0 || inconclusive;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[auth] decision', { serverExists, methods, inconclusive, exists });
        toast({ title: 'Auth Debug', description: `serverExists=${serverExists} methods=${methods.join(',')||'[]'} inconclusive=${inconclusive} exists=${exists}` });
      }
      setPhase(exists ? 'login' : 'signup');
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        logger.error("🔥 Full Auth Error (Email Check):", error);
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
    const emailSanitized = (values.email || '').trim().toLowerCase();
    const passwordSanitized = (values.password || '').trim();
    if (process.env.NODE_ENV !== "production") {
      logger.debug("🚨 Attempting login with (sanitized):", { emailSanitized, hasPassword: !!passwordSanitized });
    }
    try {
      const userCredential = await signInWithEmailAndPassword(getAuth(), emailSanitized, passwordSanitized);
      if (process.env.NODE_ENV !== "production") {
        logger.debug("✅ Sign in successful. Firebase User Credential:", userCredential);
        logger.debug("👤 Firebase currentUser after sign in:", getAuth().currentUser);
      }

      // Profile document is created lazily by backend flows; skip here

      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(getAuth(), (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
      });

      if (process.env.NODE_ENV !== "production") {
        logger.debug("User after login state stabilization:", getAuth().currentUser);
      }

      toast({ title: "Signed in successfully!" });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      if (process.env.NODE_ENV !== "production") {
        logger.error("🔥 Full Auth Error (Login):", error);
        logger.error("🔥 Login Error Code:", authError.code);
        logger.error("🔥 Login Error Message:", authError.message);
      }
      // Friendlier error mapping with provider guidance
      const code = authError.code;
      if (code === 'auth/invalid-credential') {
        try {
          const methods = await fetchSignInMethodsForEmail(getAuth(), emailSanitized);
          if (methods.length && !methods.includes('password')) {
            const provider = methods.includes('google.com') ? 'Google' : methods.includes('apple.com') ? 'Apple' : 'your original provider';
            toast({
              title: 'Use your original sign-in method',
              description: `This email is registered with ${provider}. Please sign in with ${provider} or reset your password if you added one.`,
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Invalid email or password', description: 'Please check your credentials and try again.', variant: 'destructive' });
          }
        } catch {
          toast({ title: 'Invalid credentials', description: 'Please check your email and password.', variant: 'destructive' });
        }
        return;
      }

      const friendly: Record<string, string> = {
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/user-disabled': 'This account has been disabled. Contact support if this is unexpected.',
        'auth/invalid-email': 'The email format is invalid.',
        'auth/network-request-failed': 'Network error. Please check your connection and try again.',
      };
      toast({
        title: 'Sign In Failed',
        description: friendly[code] || authError.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit: SubmitHandler<SignupFormValues> = async (values) => {
    if (process.env.NODE_ENV !== "production") {
      logger.debug("📨 Signup form submitted with (from submit handler 'values' arg):", values);
        const currentRHFValues = signupForm.getValues();
      logger.debug("🧾 Values in RHF before explicit trigger (from signupForm.getValues()):", currentRHFValues);
        if(values.password !== currentRHFValues.password) {
            logger.warn("PASSWORD MISMATCH DETECTED (PRE-TRIGGER): 'values' argument from handleSubmit is different from signupForm.getValues() for the password field.");
        }
         if (!currentRHFValues.password || currentRHFValues.password.length < 6) {
            logger.error("SIGNUP SUBMIT DIAGNOSTIC (PRE-TRIGGER): Password in RHF (getValues) appears invalid or empty:", `"${currentRHFValues.password}"`);
        }
    }

    const isValid = await signupForm.trigger();
    if (process.env.NODE_ENV !== "production") {
        const postTriggerRHFValues = signupForm.getValues();
      logger.debug("🧾 Values in RHF after explicit trigger (from signupForm.getValues()):", postTriggerRHFValues);
      logger.debug("🧾 Form validity after trigger:", isValid);
         if(values.password !== postTriggerRHFValues.password && isValid) {
            logger.warn("PASSWORD MISMATCH DETECTED (POST-TRIGGER & VALID): 'values' argument from handleSubmit is different from signupForm.getValues() for the password field, even though form is considered valid.");
        }
        if (!postTriggerRHFValues.password || postTriggerRHFValues.password.length < 6) {
            logger.error("SIGNUP SUBMIT DIAGNOSTIC (POST-TRIGGER): Password in RHF (getValues) appears invalid or empty AFTER trigger:", `"${postTriggerRHFValues.password}"`);
        }
    }

    if (!isValid) {
      toast({
        title: "Missing or Invalid Fields",
        description: "Please fill in all required fields correctly (e.g. password min 6 chars).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const finalValuesForFirebase = signupForm.getValues(); // Use getValues after trigger for most certainty
    finalValuesForFirebase.email = (finalValuesForFirebase.email || '').trim().toLowerCase();
    finalValuesForFirebase.password = (finalValuesForFirebase.password || '').trim();
    if (process.env.NODE_ENV !== "production") {
      logger.debug("ℹ️ Starting sign-up process with FINAL values for Firebase:", finalValuesForFirebase);
      logger.debug("🚀 Attempting to sign up with email:", finalValuesForFirebase.email, "and password:", finalValuesForFirebase.password ? "********" : "(empty)");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), finalValuesForFirebase.email, finalValuesForFirebase.password);
      if (process.env.NODE_ENV !== "production") {
        logger.debug("✅ Sign up successful. Firebase User Credential:", userCredential);
      }

      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: finalValuesForFirebase.fullName });
        try {
          const db = getDb();
          const uref = doc(db, 'users', userCredential.user.uid);
          await setDoc(uref, {
            uid: userCredential.user.uid,
            email: finalValuesForFirebase.email,
            fullName: (finalValuesForFirebase.fullName || '').trim(),
            kycVerified: false,
            registeredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          logger.error('Failed to create user profile document at signup:', e);
        }
      }
      if (process.env.NODE_ENV !== "production") {
        logger.debug("🧾 Firebase current user immediately after signup success in try block:", getAuth().currentUser);
      }

      await new Promise<void>((resolve) => {
        const unsub = onAuthStateChanged(getAuth(), (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
      });

      // Send email verification (best effort)
      try {
        const { sendEmailVerification } = await import('firebase/auth');
        const currentAuth = getAuth();
        if (currentAuth.currentUser) await sendEmailVerification(currentAuth.currentUser);
      } catch {}
      toast({
        title: "Account Created!",
        description: "Verification email sent. Please verify your email.",
        duration: 7000,
      });
      const returnTo = searchParams.get("returnTo");
      router.push(returnTo || "/verify-identity");
    } catch (error) {
      const authError = error as AuthError;
      if (process.env.NODE_ENV !== "production") {
       logger.error("🔥 Full Auth Error (Signup):", error);
       logger.error("🔥 Signup Error Code:", authError.code);
       logger.error("🔥 Signup Error Message:", authError.message);
      }

      if (authError.code === "auth/email-already-in-use") {
        toast({
          title: "Email Already Registered",
          description: "That email has already been used. Try signing in instead.",
          variant: "destructive",
        });
        setPhase("login");
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

  const safeEmailSubmit = useFormEnterSubmit(emailForm.handleSubmit, handleEmailSubmit);
  const safeLoginSubmit = useFormEnterSubmit(loginForm.handleSubmit, handleLoginSubmit);
  const safeSignupSubmit = useFormEnterSubmit(signupForm.handleSubmit, handleSignUpSubmit);


  const renderFormContent = () => {
    if (phase === "email") {
      if (process.env.NODE_ENV !== "production") {
        logger.debug("🧪 Rendering EMAIL form with values:", emailForm.getValues());
      }
      return (
        <form 
          onKeyDown={safeEmailSubmit} 
          onSubmit={emailForm.handleSubmit(handleEmailSubmit)} 
          className="space-y-6"
        >
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
                {...emailForm.register("email", {
                  setValueAs: (value) => value.trim().toLowerCase(), // Trim and lowercase the email
                  required: "Email is required",
                  pattern: { value: /\S+@\S+\.\S+/, message: "Entered value does not match email format" }
                })}
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
        logger.debug("🧪 Rendering LOGIN form with values:", loginForm.getValues());
      }
      return (
        <form 
          onKeyDown={safeLoginSubmit} 
          onSubmit={loginForm.handleSubmit(handleLoginSubmit)} 
          className="space-y-6"
        >
          <h2 className="text-xl font-semibold text-white">Welcome Back</h2>
          <p className="text-sm text-white/50">
            Logging in as <span className="font-medium text-rose-400">{email}</span>.
            Not you? <Button variant="link" className="p-0 h-auto text-sm text-rose-400 underline hover:text-white transition" onClick={() => { setPhase("email"); emailForm.reset(); loginForm.reset(); signupForm.reset(); }}>Start Over</Button>
          </p>
          <div>
            <Label htmlFor="login-password" className="text-white">Password</Label> {/* Fixed: className for Label */}
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="login-password"
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
          {(signInHints.includes('google.com') || signInHints.includes('apple.com')) && (
            <div className="mt-2 flex items-center justify-center gap-2">
              {signInHints.includes('google.com') && (
                <Button variant="outline" disabled title="Use your Google sign-in">
                  <Chrome className="mr-2 h-4 w-4" /> Sign in with Google
                </Button>
              )}
              {signInHints.includes('apple.com') && (
                <Button variant="outline" disabled title="Use your Apple sign-in">
                  <Apple className="mr-2 h-4 w-4" /> Sign in with Apple
                </Button>
              )}
            </div>
          )}
        </form>
      );
    }

    if (phase === "signup") {
      if (process.env.NODE_ENV !== "production") {
        logger.debug("🧪 Rendering SIGNUP form with values:", signupForm.getValues());
      }
      return (
        <form
          onKeyDown={safeSignupSubmit}
          onSubmit={signupForm.handleSubmit(handleSignUpSubmit, (errors) => {
            if (process.env.NODE_ENV !== "production") {
                logger.warn("❌ Signup form validation failed on submit:", errors);
            }
            toast({
                title: "Missing Fields on Submit",
                description: "Please fill in all required fields correctly before submitting.",
                variant: "destructive",
            });
         })}
          className="space-y-6"
        >
          <h2 className="text-xl font-semibold text-white">Create Your Account</h2>
          <p className="text-sm text-white/50">
            Signing up with <span className="font-medium text-rose-400">{email}</span>.
            Already have an account? <Button variant="link" className="p-0 h-auto text-sm text-rose-400 underline hover:text-white transition" onClick={() => {
                setPhase("login");
            }}>Sign In</Button>
          </p>
          <div>
            <Label htmlFor="signup-fullName" className="text-white">Full Name</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="signup-fullName"
                placeholder="First Last"
                className="w-full pl-10 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...signupForm.register("fullName", { setValueAs: v => (v ?? '').toString().trim() })}
              />
            </div>
            <p className="mt-1 text-xs text-white/50">Use your real first and last name.</p>
            {(signupForm.formState.touchedFields.fullName || signupForm.formState.isSubmitted) && signupForm.formState.errors.fullName && (
              <p className="mt-2 text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="signup-password" className="text-white">Password</Label> {/* Fixed: className for Label */}
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <Input
                id="signup-password"
                type="password"
                placeholder="•••••••• (min. 6 characters)"
                className="w-full pl-10 pr-10 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-md transition h-12"
                {...signupForm.register("password", { setValueAs: v => (v ?? '').toString().trim() })}
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
            {(signupForm.formState.touchedFields.password || signupForm.formState.isSubmitted) && signupForm.formState.errors.password && (
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
