
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export default function AccountSuspendedPage() {
  const router = useRouter();
  const { kycVerified, isSuspended, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (kycVerified) {
        // If user somehow lands here but is verified, redirect them away
        router.replace("/dashboard");
      } else if (!isSuspended) {
        // If user is not suspended (e.g. within grace period), redirect to KYC
        router.replace("/verify-identity");
      }
    }
  }, [kycVerified, isSuspended, authLoading, router]);


  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 animate-pulse text-destructive" />
        <p className="mt-4 text-lg text-foreground">Loading account status...</p>
      </div>
    );
  }
  
  // This content will show if !kycVerified AND isSuspended
  return (
    <div className="container mx-auto py-10 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="max-w-md mx-auto shadow-xl border-destructive">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle className="text-2xl text-destructive">Account Access Restricted</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your account access has been temporarily restricted because your identity verification is overdue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-foreground">
            To restore full access to db8, including posting and creating debates, please complete your identity verification.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/verify-identity">Complete Verification</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
