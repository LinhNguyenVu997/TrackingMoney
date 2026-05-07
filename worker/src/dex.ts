interface DexPairResponse {
  pairs?: Array<{
    chainId: string;
    pairAddress: string;
    baseToken: { address: string; symbol: string; name: string };
    priceUsd: string;
  }>;
}

export interface PairMeta {
  chain: string;
  pairAddress: string;
  baseMint: string;
  symbol: string;
  name: string;
  priceUsd: number;
}

const cache = new Map<string, PairMeta>();

export async function fetchPair(chain: string, pairAddress: string): Promise<PairMeta | null> {
  const url = `https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as DexPairResponse;
  const p = data.pairs?.[0];
  if (!p) return null;
  return {
    chain: p.chainId,
    pairAddress: p.pairAddress,
    baseMint: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    priceUsd: Number(p.priceUsd),
  };
}

export async function getPairMeta(chain: string, pairAddress: string): Promise<PairMeta | null> {
  const key = `${chain}:${pairAddress}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const meta = await fetchPair(chain, pairAddress);
  if (meta) cache.set(key, meta);
  return meta;
}

export async function refreshPrices() {
  for (const [, meta] of cache) {
    const fresh = await fetchPair(meta.chain, meta.pairAddress);
    if (fresh) cache.set(`${meta.chain}:${meta.pairAddress}`, fresh);
  }
}
