import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

function genCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from('telegram_link_codes').insert({
    code,
    user_id: user.id,
    expires_at: expiresAt,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code, expires_at: expiresAt });
}
