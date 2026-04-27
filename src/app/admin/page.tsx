import { db } from '@/lib/db';
import { UsersTable } from './UsersTable';

export default async function AdminPage() {
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

  return (
    <div>
      <UsersTable
        users={users.map((u) => ({
          ...u,
          dailyUsdCap: u.dailyUsdCap === null ? null : Number(u.dailyUsdCap),
          createdAt: u.createdAt.toISOString(),
          approvedAt: u.approvedAt?.toISOString() ?? null,
          redeemedAt: u.redeemedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
