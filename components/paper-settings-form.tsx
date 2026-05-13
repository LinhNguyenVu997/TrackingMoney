'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface PaperSettings {
  enabled: boolean;
  position_size_usd: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_hold_hours: number;
  follow_whale_buy: boolean;
  follow_cluster_buy: boolean;
  follow_wallet_activity: boolean;
}

const DEFAULTS: PaperSettings = {
  enabled: false,
  position_size_usd: 50,
  stop_loss_pct: 20,
  take_profit_pct: 50,
  max_hold_hours: 24,
  follow_whale_buy: true,
  follow_cluster_buy: true,
  follow_wallet_activity: false,
};

export function PaperSettingsForm() {
  const [s, setS] = useState<PaperSettings | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('paper_settings')
        .select('enabled, position_size_usd, stop_loss_pct, take_profit_pct, max_hold_hours, follow_whale_buy, follow_cluster_buy, follow_wallet_activity')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) setS((data as PaperSettings) ?? DEFAULTS);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!userId || !s) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('paper_settings').upsert({
      user_id: userId,
      ...s,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Paper settings saved');
  }

  if (!s) return <Skeleton className="h-48 w-full" />;

  function update<K extends keyof PaperSettings>(key: K, value: PaperSettings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
        />
        <span className="font-medium">Enable paper trading</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Position size (USD)">
          <Input
            type="number"
            min="1"
            value={s.position_size_usd}
            onChange={(e) => update('position_size_usd', Number(e.target.value))}
          />
        </Field>
        <Field label="Max hold (hours)">
          <Input
            type="number"
            min="1"
            value={s.max_hold_hours}
            onChange={(e) => update('max_hold_hours', Number(e.target.value))}
          />
        </Field>
        <Field label="Stop loss %">
          <Input
            type="number"
            min="1"
            max="100"
            value={s.stop_loss_pct}
            onChange={(e) => update('stop_loss_pct', Number(e.target.value))}
          />
        </Field>
        <Field label="Take profit %">
          <Input
            type="number"
            min="1"
            value={s.take_profit_pct}
            onChange={(e) => update('take_profit_pct', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Open positions on signals:</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.follow_whale_buy}
            onChange={(e) => update('follow_whale_buy', e.target.checked)}
          />
          🐋 Whale buy (single large buy)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.follow_cluster_buy}
            onChange={(e) => update('follow_cluster_buy', e.target.checked)}
          />
          🟢 Cluster buy (multiple coordinated buys)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.follow_wallet_activity}
            onChange={(e) => update('follow_wallet_activity', e.target.checked)}
            disabled
          />
          👤 Wallet activity{' '}
          <span className="text-xs text-muted-foreground">(not yet — multi-mint price lookup)</span>
        </label>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
