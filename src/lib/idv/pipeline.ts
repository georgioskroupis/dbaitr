export type VerifyResult = { approved: boolean; reason?: string | null };

export async function serverVerify(front: Blob, back: Blob, selfie: Blob): Promise<VerifyResult> {
  try {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    fd.append('selfie', selfie);
    const { apiFetch } = await import('@/lib/http/client');
    const resp = await apiFetch('/api/idv/verify', {
      method: 'POST',
      body: fd,
    });
    const data = await resp.json();
    return { approved: !!data?.approved, reason: data?.reason || null };
  } catch {
    return { approved: false, reason: 'server_fallback_error' };
  }
}
