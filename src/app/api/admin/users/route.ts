import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      email: true,
      status: true,
      isAdmin: true,
      dailyUsdCap: true,
      note: true,
      createdAt: true,
      approvedAt: true,
      redeemedAt: true,
    },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      dailyUsdCap: u.dailyUsdCap === null ? null : Number(u.dailyUsdCap),
    })),
  });
}

const PatchBody = z.object({
  userId: z.string().min(1),
  dailyUsdCap: z.number().nullable().optional(),
  status: z.enum(['WAITLIST', 'INVITED', 'ACTIVE', 'DISABLED']).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }

  const data: { dailyUsdCap?: number | null; status?: 'WAITLIST' | 'INVITED' | 'ACTIVE' | 'DISABLED' } = {};
  if ('dailyUsdCap' in parsed) data.dailyUsdCap = parsed.dailyUsdCap ?? null;
  if (parsed.status) data.status = parsed.status;

  const updated = await db.user.update({
    where: { id: parsed.userId },
    data,
    select: { id: true, email: true, status: true, dailyUsdCap: true },
  });
  return NextResponse.json({
    ok: true,
    user: { ...updated, dailyUsdCap: updated.dailyUsdCap === null ? null : Number(updated.dailyUsdCap) },
  });
}
