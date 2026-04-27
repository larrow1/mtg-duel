import Link from 'next/link';
import { UserMenu } from '@/components/UserMenu';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">mtg-duel</h1>
          <p className="mt-3 text-neutral-400">
            Cube draft assistant for the MTGO Vintage Cube. Pick from each pack; we rank using pool
            synergy, archetype signals, and a Claude consultant.
          </p>
        </div>
        <UserMenu />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/mock-draft"
          className="rounded-lg bg-white px-5 py-3 font-medium text-black hover:bg-neutral-200"
        >
          Mock draft (vs. 7 bots)
        </Link>
        <Link
          href="/draft"
          className="rounded-lg border border-neutral-700 px-5 py-3 font-medium text-neutral-200 hover:border-neutral-400"
        >
          Live draft (manual pack entry)
        </Link>
      </div>
    </main>
  );
}
