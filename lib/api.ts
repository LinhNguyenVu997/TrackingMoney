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

export async function getPair(chain: string, pairAddress: string): Promise<DexPair | null> {
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/pairs/${chain}/${pairAddress}`);
  const data: { pairs?: DexPair[] } = await res.json();
  return data.pairs?.[0] ?? null;
}

export async function searchPairs(query: string, chain?: string): Promise<DexPair[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data: { pairs?: DexPair[] } = await res.json();
  let pairs = data.pairs ?? [];
  if (chain) pairs = pairs.filter((p) => p.chainId === chain);
  return pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0)).slice(0, 8);
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Timeframe = 'minute' | 'hour' | 'day';

export async function getOHLCV(
  chain: string,
  pairAddress: string,
  timeframe: Timeframe = 'hour',
  aggregate = 1,
  limit = 200
): Promise<Candle[]> {
  const url = `/api/ohlcv/${chain}/${pairAddress}?timeframe=${timeframe}&aggregate=${aggregate}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: { ohlcv_list?: number[][] } = await res.json();
  return (data.ohlcv_list ?? [])
    .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
    .sort((a, b) => a.time - b.time);
}

export interface Trade {
  id: string;
  kind: 'buy' | 'sell';
  blockTimestamp: string;
  volumeUsd: number;
  priceUsd: number;
  txHash: string;
  wallet: string;
}

interface GeckoTradeAttributes {
  kind: 'buy' | 'sell';
  block_timestamp: string;
  volume_in_usd: string;
  price_to_in_usd?: string;
  price_from_in_usd?: string;
  tx_hash: string;
  tx_from_address: string;
}

export async function getTrades(chain: string, pairAddress: string): Promise<Trade[]> {
  const res = await fetch(`/api/trades/${chain}/${pairAddress}`);
  if (!res.ok) return [];
  const data: { data?: Array<{ id: string; attributes: GeckoTradeAttributes }> } = await res.json();
  return (data.data ?? []).map((t) => ({
    id: t.id,
    kind: t.attributes.kind,
    blockTimestamp: t.attributes.block_timestamp,
    volumeUsd: Number(t.attributes.volume_in_usd),
    priceUsd: Number(t.attributes.price_to_in_usd ?? t.attributes.price_from_in_usd ?? 0),
    txHash: t.attributes.tx_hash,
    wallet: t.attributes.tx_from_address,
  }));
}

export interface Holder {
  owner: string;
  amount: string;
  decimals: number;
}

export async function getHolders(mint: string): Promise<Holder[] | null> {
  const res = await fetch(`/api/holders/${mint}`);
  if (!res.ok) return null;
  const data: { holders?: Holder[] } = await res.json();
  return data.holders ?? [];
}
