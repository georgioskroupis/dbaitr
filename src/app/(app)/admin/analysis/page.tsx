"use client";

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, where, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type Cat = 'tone'|'style'|'outcome'|'substance'|'engagement'|'argumentation';

const CAT_VALUES: Record<Cat, string[]> = {
  tone: ['heated','calm'],
  style: ['structured','informal'],
  outcome: ['controversial','consensus'],
  substance: ['evidence','opinion'],
  engagement: ['active','dormant'],
  argumentation: ['solid','weak'],
};

type Row = { id: string; title: string; analysis?: any; analysis_flat?: any };

export default function AdminAnalysisPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const canModerate = !!isAdmin; // claim-based to avoid client Firestore read dependency
  const [primaryCat, setPrimaryCat] = useState<Cat>('tone');
  const [primaryVal, setPrimaryVal] = useState<string>('');
  const [secondaryCat, setSecondaryCat] = useState<Cat | ''>('');
  const [secondaryVal, setSecondaryVal] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkCat, setBulkCat] = useState<Cat>('tone');
  const [bulkVal, setBulkVal] = useState<string>('heated');
  const [bulkNote, setBulkNote] = useState<string>('');

  const hasTwoFilters = !!(secondaryCat && secondaryVal);
  const twoFilterWarning = useMemo(() => !hasTwoFilters && secondaryCat && !secondaryVal, [hasTwoFilters, secondaryCat, secondaryVal]);

  async function loadPage(reset = true) {
    setLoading(true);
    try {
      const col = collection(db, 'topics');
      const clauses: any[] = [];
      if (primaryVal) clauses.push(where(`analysis_flat.${primaryCat}`, '==', primaryVal));
      if (secondaryCat && secondaryVal) clauses.push(where(`analysis_flat.${secondaryCat}`, '==', secondaryVal));
      let q = query(col, ...clauses, orderBy('analysis_flat.updatedAt', 'desc'), limit(20));
      if (!reset && nextCursor) q = query(col, ...clauses, orderBy('analysis_flat.updatedAt', 'desc'), startAfter(nextCursor), limit(20));
      const snap = await getDocs(q);
      const list: Row[] = snap.docs.map(d => ({ id: d.id, title: (d.data() as any)?.title || '(untitled)', analysis: (d.data() as any)?.analysis, analysis_flat: (d.data() as any)?.analysis_flat }));
      setRows(reset ? list : [...rows, ...list]);
      setNextCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
    } catch (e) {
      toast({ title: 'Query failed', description: 'Check indexes or filters.', variant: 'destructive' });
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryCat, primaryVal, secondaryCat, secondaryVal]);

  async function applyBulk() {
    if (!user) return;
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    const t = await user.getIdToken();
    let ok = 0, fail = 0;
    for (const topicId of ids) {
      try {
        const res = await fetch('/api/admin/analysis/override', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ topicId, category: bulkCat, value: bulkVal, note: bulkNote || undefined }) });
        if (!res.ok) throw new Error('bad');
        ok++;
      } catch { fail++; }
    }
    toast({ title: 'Bulk overrides complete', description: `${ok} ok, ${fail} failed.` });
    setSelected({});
    loadPage(true);
  }

  if (!canModerate) {
    return (
      <div className="container mx-auto py-10">
        <p className="text-white/70">Admins/moderators only.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-semibold text-white">Analysis — Bulk Overrides</h1>

      <Card className="bg-black/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Filters (max two categories; sorted by recency)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-white/60 mb-1">Primary</div>
            <div className="flex gap-2">
              <Select value={primaryCat} onValueChange={v => setPrimaryCat(v as Cat)}>
                <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  {Object.keys(CAT_VALUES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={primaryVal} onValueChange={setPrimaryVal}>
                <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  <SelectItem value="">Any</SelectItem>
                  {CAT_VALUES[primaryCat].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Secondary</div>
            <div className="flex gap-2">
              <Select value={secondaryCat || ''} onValueChange={v => setSecondaryCat(v as Cat)}>
                <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="(none)" /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  <SelectItem value="">(none)</SelectItem>
                  {Object.keys(CAT_VALUES).filter(c => c !== primaryCat).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={secondaryVal} onValueChange={setSecondaryVal} disabled={!secondaryCat}>
                <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  <SelectItem value="">Any</SelectItem>
                  {secondaryCat && CAT_VALUES[secondaryCat as Cat].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {twoFilterWarning && <div className="text-xs text-amber-300 mt-1">Choose a value or clear secondary filter.</div>}
          </div>

          <Button onClick={() => loadPage(true)} disabled={loading} className="h-9">{loading ? 'Loading…' : 'Apply'}</Button>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Bulk override</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2 flex-wrap">
          <Select value={bulkCat} onValueChange={v => setBulkCat(v as Cat)}>
            <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-black/90 border-white/10 text-white">
              {(Object.keys(CAT_VALUES) as Cat[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={bulkVal} onValueChange={setBulkVal}>
            <SelectTrigger className="w-40 h-9 bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-black/90 border-white/10 text-white">
              {CAT_VALUES[bulkCat].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Note (optional)" value={bulkNote} onChange={e => setBulkNote(e.target.value)} className="h-9 w-64 bg-white/5 border-white/20 text-white" />
          <Button onClick={applyBulk} disabled={Object.values(selected).every(v => !v)} className="h-9">Apply to selected</Button>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/70">
                  <th className="text-left p-2 w-8"></th>
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Tone</th>
                  <th className="text-left p-2">Style</th>
                  <th className="text-left p-2">Outcome</th>
                  <th className="text-left p-2">Substance</th>
                  <th className="text-left p-2">Engagement</th>
                  <th className="text-left p-2">Argumentation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-2 align-top">
                      <Checkbox checked={!!selected[r.id]} onCheckedChange={(v: any) => setSelected(s => ({ ...s, [r.id]: !!v }))} />
                    </td>
                    <td className="p-2 align-top">
                      <div className="text-white">{r.title}</div>
                      <div className="text-white/50 text-xs">{r.id}</div>
                    </td>
                    {(['tone','style','outcome','substance','engagement','argumentation'] as Cat[]).map(cat => (
                      <td key={cat} className="p-2 align-top">
                        <div className="text-white/80 capitalize">{r.analysis?.categories?.[cat]?.value || '—'}</div>
                        <div className="text-white/40 text-[10px]">{Math.round((r.analysis?.categories?.[cat]?.confidence || 0)*100)}% conf</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center mt-3">
            <Button variant="outline" onClick={() => loadPage(false)} disabled={loading || !nextCursor} className="bg-white/5 border-white/20 text-white">{nextCursor ? (loading ? 'Loading…' : 'Load more') : 'End of list'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
