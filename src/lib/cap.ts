import 'server-only';
import { db } from './db';

export class DailyCapExceeded extends Error {
  spent: number;
  cap: number;
  constructor(spent: number, cap: number) {
    super(`Daily Claude API cap reached ($${spent.toFixed(2)} of $${cap.toFixed(2)}). Resets at midnight UTC.`);
    this.spent = spent;
    this.cap = cap;
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function todaysSpend(userId: string): Promise<number> {
  const since = startOfTodayUtc();
  const rows = await db.claudeUsage.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { costUsd: true },
  });
  return rows.reduce((s, r) => s + Number(r.costUsd), 0);
}

export async function assertWithinCap(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { dailyUsdCap: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('User not active');
  }
  if (user.dailyUsdCap === null) return; // unlimited (e.g. admin)
  const cap = Number(user.dailyUsdCap);
  const spent = await todaysSpend(userId);
  if (spent >= cap) throw new DailyCapExceeded(spent, cap);
}
