import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';

// Use the edge-safe config — no DB, no bcrypt — so the middleware bundle
// stays under Vercel's 1 MB Edge Function limit.
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/redeem',
  '/api/auth',
  '/api/signup',
  '/api/redeem',
  '/_next',
  '/favicon',
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && !session.user.isAdmin) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)'],
};
