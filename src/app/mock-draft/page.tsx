import { MockDraftBoard } from '@/components/MockDraftBoard';

export const dynamic = 'force-dynamic';

export default function MockDraftPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <MockDraftBoard />
    </main>
  );
}
