import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { TelegramLinkButton } from '@/components/telegram-link-button';
import { PaperSettingsForm } from '@/components/paper-settings-form';

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="container mx-auto p-6 max-w-2xl">
        <Card className="p-8 text-center text-muted-foreground">Supabase not configured.</Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');

  const { data: link } = await supabase
    .from('telegram_links')
    .select('chat_id, linked_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <main className="container mx-auto p-6 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Paper trading</h2>
        <p className="text-sm text-muted-foreground">
          Simulate trades on alerts to validate strategy with zero risk. Configure once → bot opens
          positions automatically and closes them at stop-loss / take-profit.
        </p>
        <PaperSettingsForm />
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Telegram alerts</h2>
        {link ? (
          <p className="text-sm text-muted-foreground">
            Linked to chat <code className="font-mono">{link.chat_id}</code> on{' '}
            {new Date(link.linked_at).toLocaleDateString()}.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Generate a one-time code, then send it to the bot to receive alerts.
            </p>
            <TelegramLinkButton botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ''} />
          </>
        )}
      </Card>
    </main>
  );
}
