const DEXSCREENER_BASE = 'https://api.dexscreener.com';

export interface DexPair {
  chainId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange: { h24: number };
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairCreatedAt: number;
}

interface TokenProfile {
  tokenAddress: string;
}

export async function getTrendingPairs(chain: string = 'solana'): Promise<DexPair[]> {
  const res = await fetch(`${DEXSCREENER_BASE}/token-profiles/latest/v1`);
  const profiles: TokenProfile[] = await res.json();

  const addresses = profiles.slice(0, 30).map((p) => p.tokenAddress).join(',');
  const detailRes = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addresses}`);
  const data: { pairs?: DexPair[] } = await detailRes.json();

  return (data.pairs || [])
    .filter((p) => p.chainId === chain && p.volume?.h24 > 10000)
    .sort((a, b) => b.volume.h24 - a.volume.h24)
    .slice(0, 20);
}
