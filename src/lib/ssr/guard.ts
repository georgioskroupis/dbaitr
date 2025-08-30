import { redirect } from 'next/navigation';
import type { Role, Status } from '@/lib/authz/types';
import { headers, cookies } from 'next/headers';

type Policy = { public?: boolean; minRole?: Role; allowedStatus?: Status[] };

export async function guardRoute(policy: Policy, options?: { returnTo?: string }) {
  if (policy.public) return;
  // Best-effort SSR presence check: require client to set ID token and App Check in cookies
  const h = headers(); void h; // reserved for future header checks
  const c = cookies();
  const idt = c.get('db8_idt')?.value;
  const act = c.get('db8_appcheck')?.value;
  if (!idt || !act) {
    const rt = options?.returnTo || '';
    redirect(`/auth${rt ? `?returnTo=${encodeURIComponent(rt)}` : ''}`);
  }
}

