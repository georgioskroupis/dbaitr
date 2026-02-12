"use client";
import * as React from 'react';
import { useAdminGate } from '@/hooks/use-admin-gate';
import { apiFetch } from '@/lib/http/client';
import { getAuth, getApp, getAppCheckToken } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Result = { status: number; body: any } | null;

function maskToken(token: string | null | undefined, n = 8) {
  if (!token) return '';
  const s = String(token);
  if (s.length <= n * 2) return s.replace(/./g, '•');
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function decodeJwt(token: string | null | undefined): any | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
    const json = atob(b64 + pad);
    return JSON.parse(json);
  } catch { return null; }
}

export default function DebugToolsClient() {
  const { allowed: hasAdminAccess, loading: adminGateLoading } = useAdminGate();
  const [idToken, setIdToken] = React.useState<string | null>(null);
  const [acToken, setAcToken] = React.useState<string | null>(null);
  const [revealId, setRevealId] = React.useState(false);
  const [revealAc, setRevealAc] = React.useState(false);
  const [appId, setAppId] = React.useState<string | null>(null);
  const [appCheckBeforeDb, setAppCheckBeforeDb] = React.useState<boolean | null>(null);

  const [debateId, setDebateId] = React.useState('');
  const [transitionTo, setTransitionTo] = React.useState<'testing' | 'live'>('testing');
  const [results, setResults] = React.useState<Record<string, Result>>({});
  const [ytStatus, setYtStatus] = React.useState<any>(null);
  const [ytStart, setYtStart] = React.useState<{ authUrl?: string } | null>(null);
  const [oauthState, setOauthState] = React.useState('');
  const [oauthProbe, setOauthProbe] = React.useState<any>(null);
  const [validateRes, setValidateRes] = React.useState<any>(null);
  const loadYtStatus = async () => {
    try {
      const res = await apiFetch('/api/integrations/youtube/status');
      const j = await res.json();
      setYtStatus(j);
    } catch { setYtStatus(null); }
  };

  React.useEffect(() => {
    // Record appId and try initializing App Check before any Firestore usage
    try { setAppId(getApp().options.appId || null); } catch { setAppId(null); }
    (async () => {
      try {
        const t = await getAppCheckToken(false);
        setAppCheckBeforeDb(!!t);
      } catch { setAppCheckBeforeDb(false); }
    })();
  }, []);

  const showTokens = async () => {
    try {
      const user = getAuth().currentUser;
      const idt = user ? await user.getIdToken(true) : null;
      const act = await getAppCheckToken(true);
      setIdToken(idt);
      setAcToken(act);
    } catch {
      setIdToken(null);
      setAcToken(null);
    }
  };

  const decodeId = React.useMemo(() => decodeJwt(idToken), [idToken]);
  const decodeAc = React.useMemo(() => decodeJwt(acToken), [acToken]);

  const run = async (key: string, url: string, init?: RequestInit) => {
    setResults((r) => ({ ...r, [key]: { status: 0, body: { pending: true } } }));
    try {
      const res = await apiFetch(url, init);
      const body = await res.json().catch(() => ({}));
      setResults((r) => ({ ...r, [key]: { status: res.status, body } }));
    } catch (e: any) {
      setResults((r) => ({ ...r, [key]: { status: 0, body: { error: String(e?.message || e) } } }));
    }
  };

  const startYoutubeConnect = async () => {
    try {
      const res = await apiFetch('/api/integrations/youtube/oauth/start', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      setYtStart(j?.ok ? { authUrl: j.authUrl } : { authUrl: undefined });
    } catch { setYtStart({ authUrl: undefined }); }
  };

  const probeOauthState = async () => {
    try {
      const res = await apiFetch(`/api/integrations/youtube/oauth/state?state=${encodeURIComponent(oauthState)}`);
      const j = await res.json().catch(() => ({}));
      setOauthProbe(j);
    } catch { setOauthProbe(null); }
  };

  const validateYoutube = async () => {
    try {
      const res = await apiFetch('/api/integrations/youtube/validate');
      const j = await res.json().catch(() => ({}));
      setValidateRes({ status: res.status, ...j });
    } catch (e: any) {
      setValidateRes({ status: 0, error: String(e?.message || e) });
    }
  };

  const remedyHint = (body: any): string | null => {
    const code = body?.error || body?.code || '';
    switch (code) {
      case 'forbidden': return 'You lack required role/status. Ensure admin & Verified.';
      case 'not_found': return 'Resource missing. Verify debateId exists and you are owner/admin.';
      case 'no_stream': return 'No YouTube stream bound. Create/bind stream first.';
      case 'no_ingestion_info': return 'YouTube ingest not ready. Check provider or bind again.';
      case 'stream_not_found': return 'YouTube stream missing. Recreate/bind a new stream.';
      case 'youtube_not_connected': return 'Reconnect YouTube integration in your account settings.';
      case 'youtube_not_connected_global_mismatch': return 'Reconnect as the owner of the required global channel.';
      case 'live_embedding_not_allowed': return 'Channel embedding is disabled in YouTube; enable embedding/defaults before creating new debates.';
      case 'login_timeout': return 'Login expired. Sign in again to refresh credentials.';
      case 'unauthenticated_appcheck': return 'App Check missing/invalid. Ensure App Check initialized client-side.';
      case 'unauthenticated': return 'Missing/invalid ID token. Ensure user is signed in.';
      default: return null;
    }
  };

  if (adminGateLoading) return <div className="p-6 text-sm text-muted-foreground">Checking admin access…</div>;
  if (!hasAdminAccess) return null; // useAdminGate handles redirects

  const canForceFast = process.env.NEXT_PUBLIC_INGEST_SAFE_MODE === '1';

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-md border p-3 text-sm bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-200/20 dark:text-yellow-200 dark:border-yellow-300/40">
        DEV-ONLY, ADMIN-ONLY — remove before prod.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Credential probe */}
          <div className="border rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">YouTube Credential Probe</div>
              <Button variant="outline" className="text-sm" onClick={loadYtStatus}>Refresh</Button>
            </div>
            {ytStatus?.ok && (
              <div className="text-xs text-muted-foreground">hasRefresh: {String(!!ytStatus.hasRefresh)}</div>
            )}
            <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify(ytStatus || { hint: 'Click Refresh' }, null, 2)}</pre>
            {ytStatus?.ok && (
              <div className="text-xs text-muted-foreground">Mode: global | Doc: _private/youtubeTokens/global/host | hasRefresh: {String(!!ytStatus.hasRefresh)} | Status: {ytStatus.status || "unknown"} | Mismatch: {String(!!ytStatus.mismatch)}</div>
            )}
          </div>
          {/* Tokens panel */}
          <div className="border rounded-md p-4 space-y-3">
            <div className="font-medium">Tokens</div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={showTokens} className="text-sm">Show Tokens</Button>
              <Button variant="secondary" className="text-sm" onClick={() => { setRevealId((v)=>!v); }}>Reveal ID</Button>
              <Button variant="secondary" className="text-sm" onClick={() => { setRevealAc((v)=>!v); }}>Reveal App Check</Button>
              <Button variant="outline" className="text-sm" onClick={() => { if (idToken) navigator.clipboard.writeText(idToken); }}>Copy ID</Button>
              <Button variant="outline" className="text-sm" onClick={() => { if (acToken) navigator.clipboard.writeText(acToken); }}>Copy App Check</Button>
            </div>
            <div className="text-xs text-muted-foreground">App: {appId || 'n/a'}</div>
            <div className="text-xs">ID token: <span className="font-mono break-all">{revealId ? (idToken || '') : maskToken(idToken)}</span></div>
            <div className="text-xs">App Check: <span className="font-mono break-all">{revealAc ? (acToken || '') : maskToken(acToken)}</span></div>
            <div className="text-xs text-muted-foreground">Init order: App Check before first DB use = {String(appCheckBeforeDb)}</div>
            <div className="text-xs">
              <div className="font-medium">Decoded payloads</div>
              <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify({
                id: decodeId ? { uid: decodeId.uid, exp: decodeId.exp, email: decodeId.email, role: decodeId.role, status: decodeId.status, kycVerified: decodeId.kycVerified } : null,
                appCheck: decodeAc ? { app_id: decodeAc.app_id || decodeAc.sub, aud: decodeAc.aud, exp: decodeAc.exp } : null,
              }, null, 2)}</pre>
            </div>
          </div>

          {/* Quick endpoints */}
          <div className="border rounded-md p-4 space-y-3">
            <div className="font-medium">Quick endpoints</div>
            <div className="flex gap-2 items-center">
              <div className="flex-1"><Input value={debateId} onChange={(e)=>setDebateId(e.target.value)} placeholder="debateId" className="text-sm" /></div>
              <select value={transitionTo} onChange={(e)=>setTransitionTo(e.target.value as any)} className="border rounded px-2 py-2 text-sm bg-background text-foreground border-input">
                <option value="testing">testing</option>
                <option value="live">live</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full text-sm" onClick={()=>run('health','/api/health')}>/api/health</Button>
              <Button variant="outline" className="w-full text-sm" onClick={()=>run('whoami','/api/admin/whoami')}>/api/admin/whoami</Button>
              <Button variant="outline" className="w-full text-sm" onClick={()=>run('echo','/api/debug/echo')}>/api/debug/echo</Button>
              <Button variant="outline" className="w-full text-sm" onClick={()=>debateId && run('ingest',`/api/live/${encodeURIComponent(debateId)}/ingest`)}>/api/live/{'{id}'} /ingest</Button>
              <Button variant="outline" className="w-full text-sm" onClick={()=>debateId && run('ingestDiag',`/api/live/${encodeURIComponent(debateId)}/ingest?diag=1`)}>/api/live/{'{id}'} /ingest?diag=1</Button>
              {canForceFast && (
                <Button variant="outline" className="w-full text-sm" onClick={()=>debateId && run('ingestFast',`/api/live/${encodeURIComponent(debateId)}/ingest?forceFast=1`)}>/api/live/{'{id}'} /ingest?forceFast=1</Button>
              )}
              <Button variant="outline" className="w-full text-sm" onClick={()=>debateId && run('transition',`/api/live/${encodeURIComponent(debateId)}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: transitionTo }) })} >/api/live/{'{id}'} /transition</Button>
            </div>
          </div>

          {/* YouTube Connect (start) */}
          <div className="border rounded-md p-4 space-y-3">
            <div className="font-medium">YouTube Connect (start)</div>
            <div className="flex gap-2 items-center">
              <Button variant="outline" className="text-sm" onClick={startYoutubeConnect}>Start OAuth</Button>
              {ytStart?.authUrl && (
                <a className="underline text-sm" href={ytStart.authUrl} target="_blank" rel="noreferrer">Open in new tab</a>
              )}
              <Button variant="outline" className="text-sm" onClick={validateYoutube}>Validate Credentials</Button>
            </div>
            {ytStart && (
              <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify(ytStart, null, 2)}</pre>
            )}
            {validateRes && (
              <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify(validateRes, null, 2)}</pre>
            )}
          </div>

          {/* OAuth State Probe */}
          <div className="border rounded-md p-4 space-y-3">
            <div className="font-medium">OAuth State Probe</div>
            <div className="flex gap-2 items-center">
              <Input value={oauthState} onChange={(e)=>setOauthState(e.target.value)} placeholder="state" className="text-sm" />
              <Button variant="outline" className="text-sm" onClick={probeOauthState}>Probe</Button>
            </div>
            {oauthProbe && (
              <>
                <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify(oauthProbe, null, 2)}</pre>
                {oauthProbe?.ok && (!oauthProbe.found || oauthProbe.used || (oauthProbe.ageSec ?? 99999) > 15*60) && (
                  <div className="text-xs text-amber-700 dark:text-amber-300">Hint: Re-start connect and complete promptly.</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {Object.entries(results).length === 0 ? (
            <div className="text-sm text-muted-foreground">No requests made yet.</div>
          ) : (
            Object.entries(results).map(([k, v]) => (
              <div key={k} className="border rounded-md p-3">
                <div className="text-sm font-medium">{k}</div>
                <div className="text-xs text-muted-foreground">Status: {v?.status ?? 0}</div>
                <pre className="mt-1 bg-muted p-2 rounded text-[11px] overflow-auto text-foreground">{JSON.stringify(v?.body, null, 2)}</pre>
                {v?.body && remedyHint(v.body) && (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">Hint: {remedyHint(v.body)}</div>
                )}
                {v?.body?.requestId && (
                  <div className="mt-1 text-[10px] text-muted-foreground">requestId: {v.body.requestId}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
