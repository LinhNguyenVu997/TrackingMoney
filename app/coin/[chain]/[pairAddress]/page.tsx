import Link from 'next/link';
import { CoinSidebar } from '@/components/coin-sidebar';
import { CoinDetailTabs } from '@/components/coin-detail-tabs';

export default async function CoinDetailPage({
  params,
}: {
  params: Promise<{ chain: string; pairAddress: string }>;
}) {
  const { chain, pairAddress } = await params;

  return (
    <main className="container mx-auto p-4 max-w-7xl">
      <Link href="/" className="text-sm text-muted-foreground hover:underline inline-block mb-4">
        ← Back
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <aside>
          <CoinSidebar chain={chain} pairAddress={pairAddress} />
        </aside>
        <section>
          <CoinDetailTabs chain={chain} pairAddress={pairAddress} />
        </section>
      </div>
    </main>
  );
}
