import { NextResponse, type NextRequest } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured', status: 503 };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };

  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adminRow) return { error: 'Forbidden', status: 403 };

  return { adminId: user.id };
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/deposits/[id]'>
) {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await ctx.params;

  let body: { action?: 'approve' | 'reject'; admin_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: req, error: fetchErr } = await svc
    .from('deposit_requests')
    .select('id, user_id, amount_usd, status')
    .eq('id', id)
    .single();
  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: `Request already ${req.status}` }, { status: 409 });
  }

  const reviewedAt = new Date().toISOString();
  const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

  const { error: updateErr } = await svc
    .from('deposit_requests')
    .update({
      status: newStatus,
      reviewed_by: guard.adminId,
      reviewed_at: reviewedAt,
      admin_note: body.admin_note?.toString().slice(0, 500) ?? null,
    })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (body.action === 'approve') {
    const { data: settings } = await svc
      .from('paper_settings')
      .select('starting_balance')
      .eq('user_id', req.user_id)
      .maybeSingle();

    const currentBalance = settings ? Number(settings.starting_balance) : 0;
    const newBalance = currentBalance + Number(req.amount_usd);

    const { error: upsertErr } = await svc.from('paper_settings').upsert({
      user_id: req.user_id,
      starting_balance: newBalance,
      updated_at: reviewedAt,
    });
    if (upsertErr) {
      return NextResponse.json({ error: `Approved but balance update failed: ${upsertErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
