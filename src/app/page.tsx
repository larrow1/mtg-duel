import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">mtg-duel</h1>
      <p className="mt-3 text-neutral-400">
        Cube draft assistant for the MTGO Vintage Cube. Type each pack as it comes; we rank picks
        using pool synergy, archetype signals, and a Claude consultant.
      </p>

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

      <section className="mt-16 space-y-3 text-sm text-neutral-400">
        <h2 className="text-base font-semibold text-neutral-200">Setup</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Copy <code className="rounded bg-neutral-800 px-1">.env.local.example</code> to{' '}
            <code className="rounded bg-neutral-800 px-1">.env.local</code> and add your{' '}
            <code className="rounded bg-neutral-800 px-1">ANTHROPIC_API_KEY</code>.
          </li>
          <li>
            Run <code className="rounded bg-neutral-800 px-1">npm run ingest:cube</code> to fetch
            the cube list.
          </li>
          <li>
            Run <code className="rounded bg-neutral-800 px-1">npm run ingest:profiles</code> to
            generate archetype tags via Claude (one-time, ~5 min).
          </li>
          <li>
            Run <code className="rounded bg-neutral-800 px-1">npm run dev</code> and start
            drafting.
          </li>
        </ol>
      </section>
    </main>
  );
}
