
import { IdvWizard } from '@/components/idv/IdvWizard';

export default function VerifyIdentityPage() {
  return (
    <>
      <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-white">Verify Your Identity</h2>
      <p className="mb-6 text-center text-sm text-white/50">We process captures ephemerally and only store a boolean verification flag.</p>
      <IdvWizard />
    </>
  );
}
