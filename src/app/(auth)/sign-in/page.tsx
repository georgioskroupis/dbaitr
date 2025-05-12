import { SignInForm } from '@/components/auth/SignInForm';

export default function SignInPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-foreground">
        Welcome Back to ArguMate
      </h2>
      <SignInForm />
    </>
  );
}
