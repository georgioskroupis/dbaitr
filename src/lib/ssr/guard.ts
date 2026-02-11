import { redirect } from 'next/navigation';
import type { Role, Status } from '@/lib/authz/types';
import { cookies } from 'next/headers';

type Policy = { public?: boolean; minRole?: Role; allowedStatus?: Status[] };

export async function guardRoute(policy: Policy, options?: { returnTo?: string }) {
  if (policy.public) return;
  // Best-effort SSR presence check: require presence cookies only (opaque, no tokens).
  const c = await cookies();
  const authPresence = c.get('db8_authp')?.value;
  const appCheckPresence = c.get('db8_appcp')?.value;
  if (!authPresence || !appCheckPresence) {
    const rt = options?.returnTo || '';
    redirect(`/auth${rt ? `?returnTo=${encodeURIComponent(rt)}` : ''}`);
  }
}
