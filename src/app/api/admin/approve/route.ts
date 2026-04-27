import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generateInviteToken } from '@/lib/tokens';

export const runtime = 'nodejs';

const ApproveBody = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = ApproveBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', detail: String(err) }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: parsed.userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.status !== 'WAITLIST' && user.status !== 'INVITED') {
    return NextResponse.json(
      { error: `Cannot issue invite for user with status ${user.status}` },
      { status: 400 },
    );
  }

  const { plaintext, hash, expiresAt } = generateInviteToken();
  await db.$transaction([
    db.inviteToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    }),
    db.user.update({
      where: { id: user.id },
      data: { status: 'INVITED', approvedAt: user.approvedAt ?? new Date() },
    }),
  ]);

  // Token is shown ONCE — admin must share it manually.
  return NextResponse.json({
    ok: true,
    email: user.email,
    token: plaintext,
    expiresAt: expiresAt.toISOString(),
    redeemUrl: `/redeem?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(plaintext)}`,
  });
}
