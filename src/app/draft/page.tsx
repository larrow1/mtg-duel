import { DraftBoard } from '@/components/DraftBoard';

export const dynamic = 'force-dynamic';

export default function DraftPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <DraftBoard />
    </main>
  );
}
