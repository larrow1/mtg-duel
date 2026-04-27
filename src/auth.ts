import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import authConfig from './auth.config';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';

const Creds = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Full server auth: edge-safe base config + Credentials provider that hits the DB.
// Used by API routes (`auth()`) and the auth API handlers. NEVER imported from
// middleware — the Prisma + bcrypt deps would blow the 1 MB Edge function limit.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (raw) => {
        const parsed = Creds.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || user.status !== 'ACTIVE' || !user.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.email,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
});

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      isAdmin: boolean;
      name?: string | null;
      image?: string | null;
    };
  }
  interface User {
    id?: string;
    isAdmin?: boolean;
  }
}
