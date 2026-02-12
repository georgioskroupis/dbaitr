import { IdvWizard } from '@/components/idv/IdvWizard';

export const dynamic = 'force-dynamic';

export default function VerifyIdentityPage() {
  return (
    <>
      <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-white">Verify Personhood</h2>
      <p className="mb-6 text-center text-sm text-white/50">
        Complete proof-of-personhood with one-time challenges. We do not store your ID images or raw proof payloads.
      </p>
      <IdvWizard />
    </>
  );
}
