import type { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/trades/[chain]/[pairAddress]'>
) {
  const { chain, pairAddress } = await ctx.params;

  const url = `https://api.geckoterminal.com/api/v2/networks/${chain}/pools/${pairAddress}/trades`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    return Response.json({ data: [] }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}
