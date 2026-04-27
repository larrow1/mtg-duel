import Link from 'next/link';
import { UserMenu } from '@/components/UserMenu';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">mtg-duel admin</h1>
          <nav className="mt-2 flex gap-4 text-sm">
            <Link href="/admin" className="text-neutral-300 hover:text-white">
              Users
            </Link>
            <Link href="/admin/usage" className="text-neutral-300 hover:text-white">
              Usage
            </Link>
            <Link href="/" className="text-neutral-500 hover:text-neutral-200">
              ← back to app
            </Link>
          </nav>
        </div>
        <UserMenu />
      </header>
      {children}
    </main>
  );
}
