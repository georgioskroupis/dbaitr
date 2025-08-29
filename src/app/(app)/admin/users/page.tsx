"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type UserRow = {
  uid: string;
  email: string | null;
  fullName: string | null;
  role?: string | null;
  status?: string | null;
  kycVerified?: boolean;
  createdAt?: string | null;
  provider?: string | null;
  lastActiveAt?: string | null;
  flagsCount?: number;
};

const PAGE_SIZES = [10, 20, 50, 100];
const SORTABLE = ['fullName','email','uid','role','status','kycVerified','createdAt','provider','lastActiveAt','flagsCount'] as const;

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [provider, setProvider] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [openUid, setOpenUid] = useState<string | null>(null);

  const canView = isAdmin; // admins only per brief (claims-based)

  async function load() {
    if (!user || !canView) return;
    setLoading(true);
    try {
      const t = await user.getIdToken();
      const res = await fetch('/api/admin/users/list', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ q, filters: { role, status, kyc, provider }, sortBy, sortDir, page, pageSize }) });
      if (!res.ok) throw new Error('Failed');
      const j = await res.json();
      setRows(j.items || []);
      setTotal(j.total || 0);
    } catch {
      toast({ title: 'Failed to load users', variant: 'destructive' });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, role, status, kyc, provider, sortBy, sortDir, page, pageSize, canView]);

  if (!canView) {
    return (
      <div className="container mx-auto py-10">
        <p className="text-white/70">Admins only.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold text-white">Users</h1>

      <Card className="bg-black/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-white/60">Search</div>
            <Input value={q} onChange={e => { setPage(1); setQ(e.target.value); }} placeholder="Email, UID (exact), Name" className="w-72 bg-white/5 border-white/20 text-white" />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Role</div>
            <Select value={role} onValueChange={v => { setPage(1); setRole(v); }}>
              <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-black/90 border-white/10 text-white">
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="super-admin">super-admin</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="moderator">moderator</SelectItem>
                <SelectItem value="supporter">supporter</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
                <SelectItem value="restricted">restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Status</div>
            <Select value={status} onValueChange={v => { setPage(1); setStatus(v); }}>
              <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-black/90 border-white/10 text-white">
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="grace">Grace Period</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">KYC</div>
            <Select value={kyc} onValueChange={v => { setPage(1); setKyc(v); }}>
              <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-black/90 border-white/10 text-white">
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Provider</div>
            <Select value={provider} onValueChange={v => { setPage(1); setProvider(v); }}>
              <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-black/90 border-white/10 text-white">
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="password">password</SelectItem>
                <SelectItem value="google">google</SelectItem>
                <SelectItem value="apple">apple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Sort</div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={v => { setPage(1); setSortBy(v); }}>
                <SelectTrigger className="w-44 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  {SORTABLE.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={v => { setPage(1); setSortDir(v as any); }}>
                <SelectTrigger className="w-28 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  <SelectItem value="asc">asc</SelectItem>
                  <SelectItem value="desc">desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Page size</div>
            <Select value={String(pageSize)} onValueChange={v => { setPage(1); setPageSize(parseInt(v,10)); }}>
              <SelectTrigger className="w-28 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-black/90 border-white/10 text-white">
                {PAGE_SIZES.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => { setQ(''); setRole(''); setStatus(''); setKyc(''); setProvider(''); }} className="bg-white/5 border-white/20 text-white">Reset</Button>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Users ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/60">
                <tr className="text-white/70">
                  <th className="text-left p-2">fullName</th>
                  <th className="text-left p-2">email</th>
                  <th className="text-left p-2">uid</th>
                  <th className="text-left p-2">role</th>
                  <th className="text-left p-2">status</th>
                  <th className="text-left p-2">kycVerified</th>
                  <th className="text-left p-2">createdAt</th>
                  <th className="text-left p-2">provider</th>
                  <th className="text-left p-2">lastActiveAt</th>
                  <th className="text-left p-2">flagsCount</th>
                  <th className="text-left p-2">actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.uid} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-2 text-white/90">{r.fullName || '—'}</td>
                    <td className="p-2 text-white/80">{r.email || '—'}</td>
                    <td className="p-2 text-white/60">{r.uid}</td>
                    <td className="p-2 text-white/80">{r.role || 'viewer'}</td>
                    <td className="p-2 text-white/80 capitalize">{r.status || 'grace'}</td>
                    <td className="p-2 text-white/80">{String(!!r.kycVerified)}</td>
                    <td className="p-2 text-white/70">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="p-2 text-white/80">{r.provider || 'unknown'}</td>
                    <td className="p-2 text-white/70">{r.lastActiveAt ? new Date(r.lastActiveAt).toLocaleString() : '—'}</td>
                    <td className="p-2 text-white/80">{r.flagsCount ?? 0}</td>
                    <td className="p-2"><Button size="sm" onClick={() => setOpenUid(r.uid)}>View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-white/60 text-sm">Page {page} / {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1} className="bg-white/5 border-white/20 text-white">Prev</Button>
              <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages} className="bg-white/5 border-white/20 text-white">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserDrawer uid={openUid} onClose={() => setOpenUid(null)} />
    </div>
  );
}

function UserDrawer({ uid, onClose }: { uid: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState<'overview'|'activity'|'security'|'flags'|'notes'>('overview');
  const [noteText, setNoteText] = useState('');
  const [reason, setReason] = useState('');
  const [roleSel, setRoleSel] = useState('viewer');
  const [kycVal, setKycVal] = useState<'true'|'false'>('true');
  const [confirmOpen, setConfirmOpen] = useState<null|{action:string; label:string}>(null);

  useEffect(() => {
    (async () => {
      if (!uid || !user) return;
      try {
        const t = await user.getIdToken();
        const res = await fetch(`/api/admin/users/get/${uid}`, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch { setData(null); toast({ title: 'Failed to load user', variant: 'destructive' }); }
    })();
  }, [uid, user]);

  return (
    <Sheet open={!!uid} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[520px] sm:w-[640px] bg-black text-white border-l border-white/10">
        <SheetHeader>
          <SheetTitle className="text-white">User</SheetTitle>
        </SheetHeader>
        {!data ? (
          <div className="p-4 text-white/60">Loading…</div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{data.fullName || '—'}</div>
                <div className="text-white/70 text-sm">{data.email || '—'}</div>
                <div className="text-white/50 text-xs">{data.uid}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-white/80">Role: {data.role || 'viewer'}</div>
                <div className="text-white/80">Status: {data.status || 'grace'}</div>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              {(['overview','activity','security','flags','notes'] as const).map(k => (
                <button key={k} className={`px-3 py-1 rounded ${tab===k?'bg-white/10':'bg-transparent text-white/70 hover:text-white'}`} onClick={() => setTab(k)}>{k}</button>
              ))}
            </div>
            <div className="min-h-40">
              {tab==='overview' && (
                <div className="space-y-1 text-sm text-white/80">
                  <div>Provider: {data.provider || 'unknown'}</div>
                  <div>Created: {data.createdAt ? new Date(data.createdAt).toLocaleString() : '—'}</div>
                  <div>Last active: {data.lastActiveAt ? new Date(data.lastActiveAt).toLocaleString() : '—'}</div>
                  <div>KYC Verified: {String(!!data.kycVerified)}</div>
                  <div>Flags: {data.flagsCount ?? 0}</div>
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="text-white mb-2 font-medium">Actions</div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton label="Suspend" onClick={() => setConfirmOpen({ action: 'suspend', label: 'SUSPEND' })} />
                      <ActionButton label="Ban" onClick={() => setConfirmOpen({ action: 'ban', label: 'BAN' })} />
                      <ActionButton label="Reinstate" onClick={() => setConfirmOpen({ action: 'reinstate', label: 'REINSTATE' })} />
                      <ActionButton label="Force sign-out" onClick={() => setConfirmOpen({ action: 'forceSignOut', label: 'SIGNOUT' })} />
                      <ActionButton label="Invalidate sessions" onClick={() => setConfirmOpen({ action: 'invalidateSessions', label: 'INVALIDATE' })} />
                      <ActionButton label="Reset password" onClick={() => setConfirmOpen({ action: 'forcePasswordReset', label: 'RESET' })} />
                      <ActionButton label="KYC override" onClick={() => setConfirmOpen({ action: 'kycOverride', label: 'KYC' })} />
                      <ActionButton label="Change role" onClick={() => setConfirmOpen({ action: 'changeRole', label: 'ROLE' })} />
                      <ActionButton variant="destructive" label="Hard delete" onClick={() => setConfirmOpen({ action: 'hardDelete', label: 'DELETE' })} />
                    </div>
                    <div className="text-xs text-white/60 mt-2">A reason is required for sensitive actions.</div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)" className="h-8 w-80 bg-white/5 border-white/20 text-white" />
                      {confirmOpen?.action === 'changeRole' && (
                        <Select value={roleSel} onValueChange={setRoleSel}>
                          <SelectTrigger className="h-8 w-40 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-black/90 border-white/10 text-white">
                            {['viewer','restricted','supporter','moderator','admin','super-admin'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      {confirmOpen?.action === 'kycOverride' && (
                        <Select value={kycVal} onValueChange={v => setKycVal(v as any)}>
                          <SelectTrigger className="h-8 w-32 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-black/90 border-white/10 text-white">
                            <SelectItem value="true">Verify</SelectItem>
                            <SelectItem value="false">Unverify</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {tab==='activity' && (
                <div className="space-y-2 text-sm text-white/80">
                  {(data.activity || []).map((a: any, i: number) => (
                    <div key={i} className="border border-white/10 rounded p-2">
                      <div className="text-white">{a.kind}</div>
                      <div className="text-white/60 text-xs">{a.id} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</div>
                      <div className="text-white/70 text-xs truncate">{a.content || ''}</div>
                    </div>
                  ))}
                  {(!data.activity || data.activity.length===0) && <div className="text-white/60">No recent activity.</div>}
                </div>
              )}
              {tab==='security' && (
                <div className="space-y-1 text-sm text-white/80">
                  <div>Sessions: {data.security?.sessions ?? '—'}</div>
                  <div>Last login: {data.security?.lastLoginAt ? new Date(data.security.lastLoginAt).toLocaleString() : '—'}</div>
                  <div>Password last set: {data.security?.passwordUpdatedAt ? new Date(data.security.passwordUpdatedAt).toLocaleString() : '—'}</div>
                </div>
              )}
              {tab==='flags' && (
                <div className="space-y-2 text-sm text-white/80">
                  {(data.flags || []).map((f: any, i: number) => (
                    <div key={i} className="border border-white/10 rounded p-2">
                      <div className="text-white">{f.reason || f.label || 'flag'}</div>
                      <div className="text-white/60 text-xs">{f.id} · {f.createdAt ? new Date(f.createdAt).toLocaleString() : ''}</div>
                    </div>
                  ))}
                  {(!data.flags || data.flags.length===0) && <div className="text-white/60">No flags.</div>}
                </div>
              )}
              {tab==='notes' && (
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex gap-2 items-center">
                    <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note (visible to moderators only)" className="h-9 bg-white/5 border-white/20 text-white" />
                    <Button size="sm" onClick={async () => {
                      if (!user) return;
                      try {
                        const t = await user.getIdToken();
                        const res = await fetch(`/api/admin/users/notes/${data.uid}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ text: noteText }) });
                        if (!res.ok) throw new Error();
                        setNoteText('');
                        // refresh notes
                        const r2 = await fetch(`/api/admin/users/get/${data.uid}`, { headers: { Authorization: `Bearer ${t}` } });
                        if (r2.ok) setData(await r2.json());
                      } catch { /* ignore */ }
                    }}>Add</Button>
                  </div>
                  {(data.notes || []).map((n: any, i: number) => (
                    <div key={i} className="border border-white/10 rounded p-2">
                      <div className="text-white/90">{n.text}</div>
                      <div className="text-white/60 text-xs">by {n.by || 'admin'} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                    </div>
                  ))}
                  {(!data.notes || data.notes.length===0) && <div className="text-white/60">No notes.</div>}
                </div>
              )}
            </div>
            <ConfirmModal open={!!confirmOpen} onOpenChange={v => !v && setConfirmOpen(null)} label={confirmOpen?.label || ''} onConfirm={async () => {
              if (!user || !confirmOpen) return;
              try {
                const t = await user.getIdToken();
                const payload: any = { action: confirmOpen.action, reason };
                if (confirmOpen.action === 'changeRole') payload.role = roleSel;
                if (confirmOpen.action === 'kycOverride') payload.kyc = kycVal === 'true';
                const res = await fetch(`/api/admin/users/action/${data.uid}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error();
                if (confirmOpen.action === 'forcePasswordReset') {
                  const j = await res.json();
                  navigator.clipboard?.writeText(j?.link || '').catch(() => {});
                }
                setReason('');
                setConfirmOpen(null);
                // Refresh drawer data
                const r2 = await fetch(`/api/admin/users/get/${data.uid}`, { headers: { Authorization: `Bearer ${t}` } });
                if (r2.ok) setData(await r2.json());
              } catch { /* ignore */ }
            }} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActionButton({ label, onClick, variant = 'default' }: { label: string; onClick: () => void; variant?: 'default'|'destructive' }) {
  return <Button size="sm" variant={variant === 'destructive' ? 'destructive' : 'secondary'} onClick={onClick}>{label}</Button>;
}

function ConfirmModal({ open, onOpenChange, label, onConfirm }: { open: boolean; onOpenChange: (v:boolean)=>void; label: string; onConfirm: () => void }) {
  const [typed, setTyped] = useState('');
  const ok = typed.trim().toUpperCase() === (label || '').toUpperCase();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-black text-white border border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Type {label} to confirm</AlertDialogTitle>
        </AlertDialogHeader>
        <Input autoFocus className="bg-white/5 border-white/20 text-white" value={typed} onChange={e => setTyped(e.target.value)} placeholder={label} />
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/10 border-white/20 text-white">Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!ok} className="bg-rose-600 hover:bg-rose-500" onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
