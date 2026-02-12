
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
        router.replace("/dashboard");
      } else if (!isSuspended) {
        router.replace("/verify-identity");
      }
    }
  }, [kycVerified, isSuspended, authLoading, router]);


  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 animate-pulse text-destructive" />
        <p className="mt-4 text-lg text-white/80">Loading account status...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-10 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="max-w-md mx-auto bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-red-500/50">
        <CardHeader className="text-center p-0 mb-6">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle className="text-2xl text-destructive font-semibold">Account Access Restricted</CardTitle>
          <CardDescription className="text-red-300/80">
            Your account access has been temporarily restricted because your personhood verification is overdue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center p-0">
          <p className="text-white/80">
            To restore full access to dbaitr, including posting and creating debates, please complete personhood verification.
          </p>
          <Button asChild size="lg" className="w-full px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition">
            <Link href="/verify-identity">Complete Personhood Check</Link>
          </Button>
          <p className="text-xs text-white/50">
            If you believe this is an error, please <Link href="/contact-support" className="text-rose-400 underline hover:text-white transition">contact support</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
