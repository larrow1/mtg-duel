import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Sign in to mtg-duel</h1>
      <p className="mt-1 text-sm text-neutral-400">Cube draft assistant — invite-only.</p>

      <Suspense fallback={<div className="mt-6 text-sm text-neutral-500">Loading…</div>}>
        <LoginForm />
      </Suspense>

      <div className="mt-6 space-y-2 text-sm text-neutral-400">
        <p>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-amber-400 hover:underline">
            Request access
          </Link>
        </p>
        <p>
          Got an invite token?{' '}
          <Link href="/redeem" className="text-amber-400 hover:underline">
            Redeem it
          </Link>
        </p>
      </div>
    </main>
  );
}
