import type { PairMeta } from './dex.js';

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmount: number | null };
}

interface TxnMeta {
  err: unknown;
  preTokenBalances?: TokenBalance[];
  postTokenBalances?: TokenBalance[];
}

interface AccountKeyEntry {
  pubkey: string;
}

interface ParsedTxn {
  signature?: string;
  transaction?: {
    signatures?: string[];
    message?: { accountKeys?: Array<AccountKeyEntry | string> };
  };
  meta?: TxnMeta;
  slot?: number;
}

export interface SwapEvent {
  signature: string;
  baseMint: string;
  symbol: string;
  pairAddress: string;
  chain: string;
  amountTokens: number;
  amountUsd: number;
  side: 'buy' | 'sell';
  buyer: string;
}

function getFeePayer(txn: ParsedTxn): string | undefined {
  const keys = txn.transaction?.message?.accountKeys ?? [];
  const first = keys[0];
  return typeof first === 'string' ? first : first?.pubkey;
}

export function detectSwap(txn: ParsedTxn, pair: PairMeta): SwapEvent | null {
  if (!txn.meta || txn.meta.err) return null;
  const pre = txn.meta.preTokenBalances ?? [];
  const post = txn.meta.postTokenBalances ?? [];
  if (pre.length === 0 && post.length === 0) return null;

  const feePayer = getFeePayer(txn);
  if (!feePayer) return null;

  const preMap = new Map<number, TokenBalance>();
  for (const b of pre) preMap.set(b.accountIndex, b);

  let userDelta = 0;
  for (const b of post) {
    if (b.mint !== pair.baseMint) continue;
    if (b.owner !== feePayer) continue;
    const before = preMap.get(b.accountIndex)?.uiTokenAmount.uiAmount ?? 0;
    const after = b.uiTokenAmount.uiAmount ?? 0;
    userDelta += after - before;
  }

  if (userDelta === 0) {
    for (const b of pre) {
      if (b.mint !== pair.baseMint) continue;
      if (b.owner !== feePayer) continue;
      const before = b.uiTokenAmount.uiAmount ?? 0;
      const stillExists = post.find((p) => p.accountIndex === b.accountIndex);
      const after = stillExists?.uiTokenAmount.uiAmount ?? 0;
      userDelta += after - before;
    }
  }

  if (userDelta === 0) return null;

  const tokens = Math.abs(userDelta);
  const usd = tokens * pair.priceUsd;
  const signature = txn.signature ?? txn.transaction?.signatures?.[0] ?? 'unknown';

  return {
    signature,
    baseMint: pair.baseMint,
    symbol: pair.symbol,
    pairAddress: pair.pairAddress,
    chain: pair.chain,
    amountTokens: tokens,
    amountUsd: usd,
    side: userDelta > 0 ? 'buy' : 'sell',
    buyer: feePayer,
  };
}
