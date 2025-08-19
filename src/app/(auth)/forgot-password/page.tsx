
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-xl font-semibold tracking-tight text-white">
        Reset Your Password
      </h2>
      <ForgotPasswordForm />
    </>
  );
}
