import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routePolicies } from '@/lib/authz/routePolicy';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[mw] hit', pathname);
  }
  // Only guard a subset to avoid overhead; APIs are enforced server-side.
  const policy = routePolicies.find(p => pathname === p.path || (p.path.endsWith('/') && pathname.startsWith(p.path)));
  if (!policy || policy.public) return NextResponse.next();
  const idp = req.cookies.get('db8_authp')?.value;
  const acp = req.cookies.get('db8_appcp')?.value;
  if (!idp || !acp) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = search ? `?returnTo=${encodeURIComponent(pathname+search)}` : `?returnTo=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
