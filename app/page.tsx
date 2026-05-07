import { CoinTable } from '@/components/coin-table';

export default function Home() {
  return (
    <main className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">🐋 Whale Tracker</h1>
      <p className="text-muted-foreground mb-6">
        Trending tokens on Solana - tự động refresh mỗi 30s
      </p>
      <CoinTable />
    </main>
  );
}
