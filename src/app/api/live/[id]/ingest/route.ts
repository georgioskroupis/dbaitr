export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, context?: { params?: any }) {
  const pIn = (context as any)?.params;
  const params = pIn && typeof pIn.then === 'function' ? await pIn : pIn;
  const requestId = Math.random().toString(36).slice(2);
  try { console.error('[ingest] handler entry', { requestId }); } catch {}

  const dev = process.env.NODE_ENV !== 'production';
  const diagnosticsEnabled = dev && process.env.INGEST_DIAGNOSTICS_ENABLED === '1';

  let NextResponse: any;
  let withAuth: any;
  let requireStatus: any;
  try {
    ({ NextResponse } = await import('next/server'));
  } catch (e: any) {
    if (dev) console.error('[ingest.import.fail]', 'next/server', e?.message || String(e));
    return new Response(
      JSON.stringify({ ok: false, error: 'server_error', reasonPhase: 'import', requestId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    ({ withAuth, requireStatus } = await import('@/lib/http/withAuth'));
  } catch (e: any) {
    if (dev) console.error('[ingest.import.fail]', '@/lib/http/withAuth', e?.message || String(e));
    return new Response(
      JSON.stringify({ ok: false, error: 'server_error', reasonPhase: 'import', requestId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const handler = withAuth(async (_req2: Request, ctx: any) => {
    const devLog = (payload: Record<string, any>, level: 'warn' | 'info' | 'error' = 'warn') => {
      try {
        if (level === 'error') console.error(JSON.stringify(payload));
        else if (dev) console.warn(JSON.stringify(payload));
        else console.log(JSON.stringify(payload));
      } catch {}
    };

    let phase: 'entry' | 'authz' | 'docload' | 'flags' | 'fastpath' | 'preflight' | 'provider' | 'handler' = 'entry';
    try {
      devLog({ level: 'info', route: `/api/live/${params?.id}/ingest`, requestId, action: 'ingest.entry', docId: params?.id }, 'warn');
    } catch {}

    if (!params?.id) {
      return NextResponse.json({ ok: false, error: 'not_found', requestId }, { status: 404 });
    }

    if (diagnosticsEnabled && process.env.INGEST_BYPASS === '1' && (ctx?.role === 'admin' || ctx?.role === 'super-admin')) {
      try { console.error('[ingest] BYPASS'); } catch {}
      return NextResponse.json({ ok: true, route: 'ingest/bypass' });
    }

    try {
      let dbMod: any = null;
      try {
        dbMod = await import('@/lib/firebase/admin');
      } catch (e: any) {
        if (dev) console.error('[ingest.import.fail]', '@/lib/firebase/admin', (e?.message || e) + '');
        return NextResponse.json({ ok: false, error: 'server_error', reasonPhase: 'import', requestId }, { status: 500 });
      }

      const db = dbMod.getDbAdmin();
      const uid = ctx?.uid as string;
      const role = ctx?.role || null;
      const status = (ctx as any)?.status || null;
      const hasAdminRole = role === 'admin' || role === 'super-admin';
      phase = 'authz';
      try {
        devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.authz', uid, role, status, hasAdminRole }, 'warn');
      } catch {}

      const ref = db.collection('liveDebates').doc(params.id);
      const snap = await ref.get();

      phase = 'docload';
      const hasDoc = !!snap.exists;
      const ownerOrPrivileged = hasDoc ? (((snap.data() as any)?.createdBy === uid) || hasAdminRole) : false;
      try {
        devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.docload', hasDoc, ownerOrPrivileged }, 'warn');
      } catch {}
      if (!hasDoc) {
        phase = 'preflight';
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.preflight', pathChosen: 'preflight', outcome: 'not_found' }, 'warn'); } catch {}
        return NextResponse.json({ ok: false, error: 'not_found', requestId }, { status: 404 });
      }

      const data = snap.data() as any;
      const youtube = data?.youtube || {};
      const hasStreamId = !!youtube?.streamId;
      const hasIngestAddress = !!youtube?.ingestAddress;
      const hasStreamName = !!youtube?.streamName;
      const mask = (v: string | null | undefined) => (v ? `${String(v).slice(0, 4)}…${String(v).slice(-4)}` : null);
      phase = 'flags';
      try {
        devLog({
          level: 'info',
          route: `/api/live/${params.id}/ingest`,
          requestId,
          action: 'ingest.flags',
          hasStreamId,
          hasIngestAddress,
          hasStreamName,
          'doc.youtube?.ingestAddress': mask(youtube?.ingestAddress),
          'doc.youtube?.streamName': mask(youtube?.streamName),
        }, 'warn');
      } catch {}

      let pathChosen: 'fastpath' | 'preflight' | 'forbidden' | 'no_doc' | 'no_stream' | 'unexpected' = 'unexpected';
      if (!ownerOrPrivileged) pathChosen = 'forbidden';
      else if (hasIngestAddress && hasStreamName) pathChosen = 'fastpath';
      else if (!hasStreamId) pathChosen = 'no_stream';
      else pathChosen = 'preflight';
      try {
        devLog({
          level: 'info',
          route: `/api/live/${params.id}/ingest`,
          requestId,
          action: 'ingest.decision',
          hasDoc,
          ownerOrPrivileged,
          hasStreamId,
          hasIngestAddress,
          hasStreamName,
          pathChosen,
        }, 'warn');
      } catch {}

      if (diagnosticsEnabled && hasAdminRole) {
        try {
          const url = new URL(req.url);
          if (url.searchParams.get('diag') === '1') {
            devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.diag' }, 'warn');
            return NextResponse.json({
              phase: 'diag',
              hasDoc,
              ownerOrPrivileged,
              hasStreamId,
              hasIngestAddress,
              hasStreamName,
              ingestAddressVal: mask(youtube?.ingestAddress),
              streamNameVal: mask(youtube?.streamName),
              pathChosen: 'diag',
              requestId,
            });
          }
          if (url.searchParams.get('forceFast') === '1' && hasIngestAddress && hasStreamName) {
            phase = 'fastpath';
            devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.forcefast' }, 'warn');
            return NextResponse.json({ ok: true, ingestAddress: youtube.ingestAddress, streamName: youtube.streamName, requestId });
          }
        } catch {}
      }

      if (pathChosen === 'forbidden') {
        phase = 'preflight';
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.preflight', pathChosen: 'preflight', outcome: 'forbidden' }, 'warn'); } catch {}
        return NextResponse.json({ ok: false, error: 'forbidden', requestId }, { status: 403 });
      }
      if (pathChosen === 'fastpath') {
        phase = 'fastpath';
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.fastpath', pathChosen: 'fastpath' }, 'warn'); } catch {}
        return NextResponse.json({ ok: true, ingestAddress: youtube.ingestAddress, streamName: youtube.streamName, requestId });
      }
      if (pathChosen === 'no_stream') {
        phase = 'preflight';
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.preflight', pathChosen: 'preflight', outcome: 'no_stream' }, 'warn'); } catch {}
        return NextResponse.json({ ok: false, error: 'no_stream', requestId }, { status: 400 });
      }

      const streamId = youtube.streamId as string;
      try {
        phase = 'provider';
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.provider', provider: { call: 'getIngest' } }, 'warn'); } catch {}
        let yMod: any = null;
        try {
          yMod = await import('@/providers/video/youtube');
        } catch (e: any) {
          if (dev) console.error('[ingest.import.fail]', '@/providers/video/youtube', (e?.message || e) + '');
          return NextResponse.json({ ok: false, error: 'server_error', reasonPhase: 'import', requestId }, { status: 500 });
        }
        const youtubeProvider = yMod.default;
        const purgeYoutubeCredentials = yMod.purgeYoutubeCredentials;
        const ingest = await youtubeProvider.getIngest(uid, streamId);
        const addr = ingest?.ingestAddress || '';
        const key = ingest?.streamName || '';
        if (!addr || !key) {
          try { devLog({ level: 'warn', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.provider', provider: { httpStatus: 200, reasons: [] }, outcome: 'no_ingestion_info' }, 'warn'); } catch {}
          return NextResponse.json({ ok: false, error: 'no_ingestion_info', requestId }, { status: 409 });
        }
        try { devLog({ level: 'info', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.provider', provider: { httpStatus: 200, reasons: [] }, outcome: 'ok' }, 'warn'); } catch {}
        return NextResponse.json({ ok: true, ingestAddress: addr, streamName: key, requestId });
      } catch (e: any) {
        const httpStatus = e?.response?.status || e?.status;
        const reasons = e?.response?.data?.error?.errors?.map((er: any) => er?.reason).filter(Boolean) || (e?.errors || []).map((er: any) => er?.reason).filter(Boolean) || [];
        const reason = reasons[0] || e?.response?.data?.error?.status || '';
        const message = (e?.message || '').toString();
        try { devLog({ level: 'error', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.provider', provider: { httpStatus, reasons }, outcome: 'error', message }, 'error'); } catch {}
        if (message === 'youtube_not_connected_global_mismatch') {
          return NextResponse.json({ ok: false, error: 'youtube_not_connected_global_mismatch', requestId }, { status: 409 });
        }
        if (httpStatus === 401 || httpStatus === 403 || reason === 'invalid_grant' || reason === 'authError' || reason === 'UNAUTHENTICATED') {
          try { await purgeYoutubeCredentials(uid); } catch {}
          return NextResponse.json({ ok: false, error: 'youtube_not_connected', requestId }, { status: 409 });
        }
        if (httpStatus === 404 || reason === 'notFound') {
          return NextResponse.json({ ok: false, error: 'stream_not_found', requestId }, { status: 404 });
        }
        try { devLog({ level: 'error', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.exception', reasonPhase: 'provider', message }, 'error'); } catch {}
        return NextResponse.json({ ok: false, error: 'server_error', reasonPhase: 'provider', requestId }, { status: 500 });
      }
    } catch (e: any) {
      const message = (e?.message || '').toString();
      try { devLog({ level: 'error', route: `/api/live/${params.id}/ingest`, requestId, action: 'ingest.exception', reasonPhase: phase || 'entry', message }, 'error'); } catch {}
      return NextResponse.json({ ok: false, error: 'server_error', reasonPhase: phase || 'entry', requestId }, { status: 500 });
    }
  }, { ...requireStatus(['Verified']) });

  return handler(req);
}
