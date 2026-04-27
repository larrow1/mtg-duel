'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface UserRow {
  id: string;
  email: string;
  status: 'WAITLIST' | 'INVITED' | 'ACTIVE' | 'DISABLED';
  isAdmin: boolean;
  dailyUsdCap: number | null;
  note: string | null;
  createdAt: string;
  approvedAt: string | null;
  redeemedAt: string | null;
}

interface ApprovalResult {
  email: string;
  token: string;
  expiresAt: string;
  redeemUrl: string;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [latest, setLatest] = useState<ApprovalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(userId: string) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `${res.status}`);
      }
      const data = (await res.json()) as ApprovalResult;
      setLatest(data);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function patchUser(userId: string, body: { dailyUsdCap?: number | null; status?: string }) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  const statusGroups = {
    WAITLIST: users.filter((u) => u.status === 'WAITLIST'),
    INVITED: users.filter((u) => u.status === 'INVITED'),
    ACTIVE: users.filter((u) => u.status === 'ACTIVE'),
    DISABLED: users.filter((u) => u.status === 'DISABLED'),
  };

  return (
    <div className="space-y-6">
      {latest && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-amber-300">Invite token for {latest.email}</h2>
            <button
              onClick={() => setLatest(null)}
              className="text-xs text-neutral-400 hover:text-neutral-200"
            >
              dismiss
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            Share this with the user. It will <strong>not be shown again</strong>. Expires{' '}
            {new Date(latest.expiresAt).toLocaleString()}.
          </p>
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs text-neutral-500">Token</span>
              <code className="mt-1 block break-all rounded bg-black/40 p-2 font-mono text-xs">
                {latest.token}
              </code>
            </div>
            <div>
              <span className="text-xs text-neutral-500">One-click redeem URL</span>
              <code className="mt-1 block break-all rounded bg-black/40 p-2 font-mono text-xs">
                {typeof window !== 'undefined' ? window.location.origin : ''}
                {latest.redeemUrl}
              </code>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(latest.token)}
              className="rounded-md border border-amber-500/40 px-3 py-1 text-xs text-amber-300 hover:border-amber-400"
            >
              Copy token
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {(['WAITLIST', 'INVITED', 'ACTIVE', 'DISABLED'] as const).map((status) => (
        <section key={status}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {status} ({statusGroups[status].length})
          </h3>
          {statusGroups[status].length === 0 ? (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-500">
              none
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-left text-xs text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Cap (USD/day)</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statusGroups[status].map((u) => (
                    <tr key={u.id} className="border-t border-neutral-800">
                      <td className="px-3 py-2">
                        {u.email}
                        {u.isAdmin && (
                          <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-300">
                            admin
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          defaultValue={u.dailyUsdCap === null ? '∞' : u.dailyUsdCap.toFixed(2)}
                          disabled={busy === u.id}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const cap = v === '∞' || v === '' ? null : Number(v);
                            if (cap !== u.dailyUsdCap) patchUser(u.id, { dailyUsdCap: cap });
                          }}
                          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-xs text-neutral-400" title={u.note ?? ''}>
                        {u.note ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          {(status === 'WAITLIST' || status === 'INVITED') && (
                            <button
                              disabled={busy === u.id}
                              onClick={() => approve(u.id)}
                              className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600 disabled:bg-neutral-700"
                            >
                              {status === 'INVITED' ? 'Re-issue' : 'Approve'}
                            </button>
                          )}
                          {status === 'ACTIVE' && (
                            <button
                              disabled={busy === u.id || u.isAdmin}
                              onClick={() => patchUser(u.id, { status: 'DISABLED' })}
                              className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-400 disabled:opacity-40"
                            >
                              Disable
                            </button>
                          )}
                          {status === 'DISABLED' && (
                            <button
                              disabled={busy === u.id}
                              onClick={() => patchUser(u.id, { status: 'ACTIVE' })}
                              className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-400"
                            >
                              Re-enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
