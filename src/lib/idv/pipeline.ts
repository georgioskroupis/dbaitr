export type VerifyResult = { approved: boolean; reason?: string | null };

export async function serverVerify(front: Blob, back: Blob, selfie: Blob, uid: string, token: string): Promise<VerifyResult> {
  try {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    fd.append('selfie', selfie);
    fd.append('uid', uid);
    const resp = await fetch('/api/idv/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await resp.json();
    return { approved: !!data?.approved, reason: data?.reason || null };
  } catch {
    return { approved: false, reason: 'server_fallback_error' };
  }
}
