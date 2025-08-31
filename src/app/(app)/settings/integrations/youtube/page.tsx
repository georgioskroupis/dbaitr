"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function YoutubeIntegrationPage() {
  const { user } = useAuth();
  const [authUrl, setAuthUrl] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [globalMode, setGlobalMode] = React.useState<{ enabled: boolean; channelId?: string | null }>({ enabled: false });
  const [role, setRole] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<{ connected: boolean; channelId?: string | null; channelTitle?: string | null; global: boolean }>({ connected: false, global: false });
  const [statusLoading, setStatusLoading] = React.useState(false);

  const refreshStatus = React.useCallback(async () => {
    setStatusLoading(true);
    try {
      // Always refresh config
      try {
        const res = await apiFetch('/api/integrations/youtube/config');
        const j = await res.json();
        if (j?.ok) setGlobalMode({ enabled: !!j.global, channelId: j.channelId });
      } catch {}

      // Refresh role
      if (user) {
        try {
          const r = await user.getIdTokenResult();
          setRole((r?.claims as any)?.role || null);
        } catch {}
      }

      // Refresh connection status
      let headers: Record<string,string> | undefined = undefined;
      const gm = (typeof window !== 'undefined' && (globalMode as any)) ? globalMode.enabled : false;
      if (user && !gm) {
        const t = await user.getIdToken();
        headers = { Authorization: `Bearer ${t}` };
      }
      const sr = await apiFetch('/api/integrations/youtube/status', { headers });
      const sj = await sr.json();
      if (sj?.ok) setStatus(sj);
    } catch {}
    finally {
      setStatusLoading(false);
    }
  }, [user, globalMode.enabled]);

  React.useEffect(() => {
    const connected = new URLSearchParams(location.search).get('connected');
    if (connected) {
      setMessage('Connected successfully.');
      // Refresh status shortly after redirect, then clean URL
      setTimeout(() => { refreshStatus(); }, 500);
      try { history.replaceState(null, '', location.pathname); } catch {}
    } else {
      refreshStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAuthUrl = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await apiFetch('/api/integrations/youtube/oauth/start', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (j?.ok) setAuthUrl(j.authUrl);
  };

  const revoke = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    await apiFetch('/api/integrations/youtube/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setMessage('Disconnected.');
    refreshStatus();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-black/40 border border-white/10 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-white">YouTube Integration</CardTitle>
        </CardHeader>
        <CardContent className="text-white/80 space-y-3">
          {globalMode.enabled ? (
            <div className="space-y-1">
              <p className="text-white">
                Global Channel Mode (Admin-only)
              </p>
              {globalMode.channelId && (
                <p className="text-white/70 text-sm">Channel ID: {globalMode.channelId}</p>
              )}
              <p className="text-white/70 text-sm">All live debates stream from a single channel with separate stream keys per debate.</p>
            </div>
          ) : (
            <p>Connect your YouTube channel to host live debates via RTMP.</p>
          )}
          {message && <p className="text-emerald-300">{message}</p>}
          <div className="text-sm text-white/80 flex items-center gap-2">
            <span>Status:</span>
            {statusLoading && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
            {status.connected ? (
              <span className="text-emerald-300">Connected{status.channelTitle ? ` to ${status.channelTitle}` : ''}{status.channelId ? ` (${status.channelId})` : ''}</span>
            ) : (
              <span className="text-white/60">Not connected</span>
            )}
          </div>
          {globalMode.enabled && !status.connected && (
            <div className="text-xs text-amber-300/90">
              Channel is configured by env but not connected. {(role === 'admin' || role === 'super-admin') ? (
                <>
                  Click <button onClick={getAuthUrl} className="underline text-amber-300">Reconnect</button> to authorize the global channel.
                </>
              ) : (
                <>Ask an admin to reconnect the global channel.</>
              )}
            </div>
          )}
          {(!globalMode.enabled || role === 'admin' || role === 'super-admin') ? (
            <>
              <div className="flex gap-2">
                <Button onClick={getAuthUrl} className="bg-rose-500 hover:bg-rose-400">{globalMode.enabled ? 'Connect Global Channel' : 'Get Connect URL'}</Button>
                <Button onClick={revoke} variant="outline">Disconnect</Button>
              </div>
              {authUrl && (
                <p className="mt-2 text-sm break-all"><a href={authUrl} className="underline">Click here to connect your channel</a></p>
              )}
            </>
          ) : (
            <p className="text-white/70 text-sm">Only admins can connect or disconnect the global channel.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { apiFetch } from '@/lib/http/client';
