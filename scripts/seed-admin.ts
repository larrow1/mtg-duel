/**
 * Bootstrap the first admin user from environment variables.
 * Idempotent: re-running is safe; updates the password if ADMIN_EMAIL already exists.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme npm run seed:admin
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in env (e.g. .env.local).');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD!, 12);
  const email = ADMIN_EMAIL!.toLowerCase().trim();
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      isAdmin: true,
      status: 'ACTIVE',
      dailyUsdCap: null, // unlimited
      approvedAt: new Date(),
      redeemedAt: new Date(),
    },
    update: {
      passwordHash,
      isAdmin: true,
      status: 'ACTIVE',
    },
  });
  console.log(`Admin user upserted: ${user.email} (id=${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
