interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmount: number | null };
}

interface ParsedTxn {
  signature?: string;
  transaction?: { signatures?: string[] };
  meta?: {
    err: unknown;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  };
}

export interface MintChange {
  mint: string;
  delta: number;
}

export interface WalletActivity {
  signature: string;
  wallet: string;
  changes: MintChange[];
  side: 'buy' | 'sell' | 'transfer';
}

export function detectWalletActivity(txn: ParsedTxn, wallet: string): WalletActivity | null {
  if (!txn.meta || txn.meta.err) return null;
  const pre = txn.meta.preTokenBalances ?? [];
  const post = txn.meta.postTokenBalances ?? [];

  const preByMint = new Map<string, number>();
  for (const b of pre) {
    if (b.owner !== wallet) continue;
    preByMint.set(b.mint, (preByMint.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0));
  }
  const postByMint = new Map<string, number>();
  for (const b of post) {
    if (b.owner !== wallet) continue;
    postByMint.set(b.mint, (postByMint.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0));
  }

  const mints = new Set([...preByMint.keys(), ...postByMint.keys()]);
  const changes: MintChange[] = [];
  for (const mint of mints) {
    const delta = (postByMint.get(mint) ?? 0) - (preByMint.get(mint) ?? 0);
    if (Math.abs(delta) > 1e-9) changes.push({ mint, delta });
  }
  if (changes.length === 0) return null;

  const positives = changes.filter((c) => c.delta > 0);
  const negatives = changes.filter((c) => c.delta < 0);
  let side: WalletActivity['side'] = 'transfer';
  if (positives.length > 0 && negatives.length > 0) {
    side = positives.reduce((s, c) => s + c.delta, 0) > 0 ? 'buy' : 'sell';
  } else if (positives.length > 0) {
    side = 'buy';
  } else if (negatives.length > 0) {
    side = 'sell';
  }

  const signature = txn.signature ?? txn.transaction?.signatures?.[0] ?? 'unknown';
  return { signature, wallet, changes, side };
}
