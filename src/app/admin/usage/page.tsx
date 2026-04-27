import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.claudeUsage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, dailyUsdCap: true } } },
    take: 1000,
  });

  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const summary = new Map<string, { email: string; calls: number; cost30: number; cost1: number; cap: number | null }>();
  for (const r of rows) {
    const cur = summary.get(r.userId) ?? {
      email: r.user.email,
      calls: 0,
      cost30: 0,
      cost1: 0,
      cap: r.user.dailyUsdCap === null ? null : Number(r.user.dailyUsdCap),
    };
    cur.calls += 1;
    cur.cost30 += Number(r.costUsd);
    if (r.createdAt >= startOfTodayUtc) cur.cost1 += Number(r.costUsd);
    summary.set(r.userId, cur);
  }
  const summaryRows = Array.from(summary.entries()).sort((a, b) => b[1].cost30 - a[1].cost30);
  const totalCost30 = summaryRows.reduce((s, [, v]) => s + v.cost30, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Usage (last 30 days)
        </h2>
        <div className="mt-2 text-3xl font-bold">${totalCost30.toFixed(4)}</div>
        <div className="text-xs text-neutral-500">
          Across {summaryRows.length} user{summaryRows.length === 1 ? '' : 's'}, {rows.length}{' '}
          Claude calls.
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          By user
        </h3>
        <div className="overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-xs text-neutral-400">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2 text-right">Calls (30d)</th>
                <th className="px-3 py-2 text-right">Today USD</th>
                <th className="px-3 py-2 text-right">30d USD</th>
                <th className="px-3 py-2 text-right">Daily cap</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-neutral-500">
                    No usage yet.
                  </td>
                </tr>
              )}
              {summaryRows.map(([userId, v]) => (
                <tr key={userId} className="border-t border-neutral-800">
                  <td className="px-3 py-2">{v.email}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{v.calls}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs ${
                      v.cap !== null && v.cost1 >= v.cap ? 'text-red-400' : ''
                    }`}
                  >
                    ${v.cost1.toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">${v.cost30.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                    {v.cap === null ? '∞' : `$${v.cap.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Recent calls (latest 50)
        </h3>
        <div className="overflow-x-auto rounded-md border border-neutral-800">
          <table className="w-full text-xs">
            <thead className="bg-neutral-900 text-left text-neutral-400">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2 text-right">In</th>
                <th className="px-3 py-2 text-right">Out</th>
                <th className="px-3 py-2 text-right">Cache R</th>
                <th className="px-3 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2 text-neutral-500">
                    {r.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.user.email}</td>
                  <td className="px-3 py-2">{r.endpoint}</td>
                  <td className="px-3 py-2 text-neutral-400">{r.model}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.inputTokens}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.outputTokens}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-500">
                    {r.cacheReadTokens}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ${Number(r.costUsd).toFixed(6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
