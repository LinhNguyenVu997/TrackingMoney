import type { NextRequest } from 'next/server';

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/ohlcv/[chain]/[pairAddress]'>
) {
  const { chain, pairAddress } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const timeframe = sp.get('timeframe') ?? 'hour';
  const aggregate = sp.get('aggregate') ?? '1';
  const limit = sp.get('limit') ?? '200';

  const url = `https://api.geckoterminal.com/api/v2/networks/${chain}/pools/${pairAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    return Response.json({ ohlcv_list: [] }, { status: res.status });
  }

  const data: { data?: { attributes?: { ohlcv_list?: number[][] } } } = await res.json();
  return Response.json({ ohlcv_list: data.data?.attributes?.ohlcv_list ?? [] });
}
