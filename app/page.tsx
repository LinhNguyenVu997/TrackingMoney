import { CoinTable } from '@/components/coin-table';

export default function Home() {
  return (
    <main className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trending on Solana</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top tokens by 24h volume · Live updates every 5s
        </p>
      </div>
      <CoinTable />
    </main>
  );
}
