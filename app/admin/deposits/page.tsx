import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured, isCurrentUserAdmin } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { AdminDepositsTable } from '@/components/admin-deposits-table';

export default async function AdminDepositsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="container mx-auto p-6 max-w-5xl">
        <Card className="p-8 text-center text-muted-foreground">Supabase not configured.</Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/deposits');

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return (
      <main className="container mx-auto p-6 max-w-5xl">
        <Card className="p-8 text-center text-muted-foreground">
          Forbidden — your account is not in the <code>admins</code> table.
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6 max-w-5xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deposit requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve user deposit requests
        </p>
      </div>
      <AdminDepositsTable />
    </main>
  );
}
