import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

// Invite tokens: random 32-byte URL-safe strings. We store the SHA-256 hash in the
// DB so a leaked database row doesn't reveal usable tokens. Plaintext is shown
// to the admin once at approval time and never again.

const TOKEN_BYTES = 32;
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInviteToken(): { plaintext: string; hash: string; expiresAt: Date } {
  const plaintext = randomBytes(TOKEN_BYTES).toString('base64url');
  const hash = hashToken(plaintext);
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
  return { plaintext, hash, expiresAt };
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
