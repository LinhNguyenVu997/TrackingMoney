import type { NextRequest } from 'next/server';

interface HeliusTokenAccount {
  address: string;
  mint: string;
  owner: string;
  amount: number;
  delegated_amount: number;
  frozen: boolean;
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/holders/[mint]'>) {
  const { mint } = await ctx.params;
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'HELIUS_API_KEY not configured', holders: [] },
      { status: 503 }
    );
  }

  const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'whale-tracker',
      method: 'getTokenAccounts',
      params: { mint, page: 1, limit: 20, options: { showZeroBalance: false } },
    }),
  });

  if (!res.ok) {
    return Response.json({ error: 'Helius request failed', holders: [] }, { status: 502 });
  }

  const data: { result?: { token_accounts?: HeliusTokenAccount[] } } = await res.json();
  const accounts = data.result?.token_accounts ?? [];

  const holders = accounts
    .map((a) => ({ owner: a.owner, amount: String(a.amount), decimals: 0 }))
    .sort((a, b) => {
      const diff = BigInt(b.amount) - BigInt(a.amount);
      const zero = BigInt(0);
      return diff > zero ? 1 : diff < zero ? -1 : 0;
    })
    .slice(0, 20);

  return Response.json({ holders });
}
