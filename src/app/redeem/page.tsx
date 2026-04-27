import { Suspense } from 'react';
import { RedeemForm } from './RedeemForm';

export const dynamic = 'force-dynamic';

export default function RedeemPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Redeem invite token</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Enter your email, the one-time token you received, and the password you want to use.
      </p>
      <Suspense fallback={<div className="mt-6 text-sm text-neutral-500">Loading…</div>}>
        <RedeemForm />
      </Suspense>
    </main>
  );
}
