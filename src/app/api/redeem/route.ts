import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/passwords';
import { hashToken } from '@/lib/tokens';

export const runtime = 'nodejs';

const RedeemBody = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  token: z.string().min(20),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RedeemBody.parse(await req.json());
  } catch (err) {
    const msg =
      err instanceof z.ZodError ? err.errors.map((e) => e.message).join('; ') : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { email, token, password } = parsed;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or token' }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const inviteToken = await db.inviteToken.findUnique({ where: { tokenHash } });
  if (!inviteToken || inviteToken.userId !== user.id) {
    return NextResponse.json({ error: 'Invalid email or token' }, { status: 400 });
  }
  if (inviteToken.usedAt) {
    return NextResponse.json({ error: 'Token already used' }, { status: 400 });
  }
  if (inviteToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 400 });
  }
  if (user.status === 'DISABLED') {
    return NextResponse.json({ error: 'Account disabled' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, status: 'ACTIVE', redeemedAt: new Date() },
    }),
    db.inviteToken.update({
      where: { id: inviteToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
