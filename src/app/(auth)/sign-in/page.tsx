
"use client";

import { SignInForm } from '@/components/auth/SignInForm'; // Updated path
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-foreground">
        Welcome Back to db8
      </h2>
      <SignInForm />
      <div className="mt-4 text-center">
        <Button variant="link" asChild className="p-0 text-sm text-muted-foreground hover:text-primary">
          <Link href="/forgot-password">Forgot Password?</Link>
        </Button>
      </div>
    </>
  );
}
