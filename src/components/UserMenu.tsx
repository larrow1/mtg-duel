'use client';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export function UserMenu() {
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (!session?.user) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      {session.user.isAdmin && (
        <Link
          href="/admin"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:border-amber-400"
        >
          admin
        </Link>
      )}
      <span className="text-neutral-400">{session.user.email}</span>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="rounded-md border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-400"
      >
        Sign out
      </button>
    </div>
  );
}
