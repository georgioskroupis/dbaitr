
import { IdVerificationForm } from '@/components/auth/IdVerificationForm';

export default function VerifyIdentityPage() {
  return (
    <>
      <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-white">
        Verify Your Identity
      </h2>
      <p className="mb-6 text-center text-sm text-white/50">
        To participate in debates, please upload a valid ID document.
      </p>
      <IdVerificationForm />
    </>
  );
}
