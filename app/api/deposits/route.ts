import { NextResponse, type NextRequest } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { amount_usd?: number; user_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amount = Number(body.amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount_usd must be a positive number' }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return NextResponse.json({ error: 'amount_usd too large' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('deposit_requests')
    .insert({
      user_id: user.id,
      amount_usd: amount,
      user_note: body.user_note?.toString().slice(0, 500) ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
