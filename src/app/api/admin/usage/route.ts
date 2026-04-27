import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.claudeUsage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
    take: 500,
  });

  const byUser = new Map<string, { email: string; calls: number; cost: number; today: number }>();
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  for (const r of rows) {
    const k = r.userId;
    const cur = byUser.get(k) ?? { email: r.user.email, calls: 0, cost: 0, today: 0 };
    cur.calls += 1;
    cur.cost += Number(r.costUsd);
    if (r.createdAt >= startOfTodayUtc) cur.today += Number(r.costUsd);
    byUser.set(k, cur);
  }

  return NextResponse.json({
    summary: Array.from(byUser.entries()).map(([userId, v]) => ({
      userId,
      email: v.email,
      calls: v.calls,
      costUsd: Math.round(v.cost * 1_000_000) / 1_000_000,
      todayUsd: Math.round(v.today * 1_000_000) / 1_000_000,
    })),
    recent: rows.slice(0, 100).map((r) => ({
      id: r.id,
      email: r.user.email,
      endpoint: r.endpoint,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      costUsd: Number(r.costUsd),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
