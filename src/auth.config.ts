import type { NextAuthConfig } from 'next-auth';

// Edge-safe Auth.js config: no Prisma, no bcrypt — only what the JWT/session
// callbacks and middleware need. Imported by both src/auth.ts (full server
// auth, with Credentials + DB) and src/middleware.ts (edge runtime, JWT-only).
//
// The Credentials provider lives in src/auth.ts because it queries the DB.
// Middleware never needs to verify passwords; it only reads the JWT from the
// session cookie, which already contains userId + isAdmin from our callbacks.

export default {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { isAdmin?: boolean }).isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
