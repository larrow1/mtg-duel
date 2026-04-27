import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const SignupBody = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  note: z.string().max(500).optional().default(''),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = SignupBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid email', detail: String(err) }, { status: 400 });
  }
  const { email, note } = parsed;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Idempotent: don't leak whether the email is already known. Always say "received."
    return NextResponse.json({ ok: true, status: existing.status });
  }

  await db.user.create({
    data: {
      email,
      note: note || null,
      status: 'WAITLIST',
    },
  });
  return NextResponse.json({ ok: true, status: 'WAITLIST' });
}
