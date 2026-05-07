'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function TelegramLinkButton({ botUsername }: { botUsername: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Failed');
        return;
      }
      const { code: c } = await res.json();
      setCode(c);
    } finally {
      setPending(false);
    }
  }

  if (code) {
    const link = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;
    return (
      <div className="space-y-2">
        <p className="text-sm">
          Code: <code className="font-mono bg-muted px-2 py-1 rounded">{code}</code>{' '}
          <span className="text-xs text-muted-foreground">(expires in 10 min)</span>
        </p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer">
            <Button>Open Telegram</Button>
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            Set <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> in <code>.env.local</code> to enable
            the deep link. Otherwise send <code>/start {code}</code> to your bot manually.
          </p>
        )}
      </div>
    );
  }

  return (
    <Button onClick={generate} disabled={pending}>
      {pending ? 'Generating...' : 'Generate link code'}
    </Button>
  );
}
