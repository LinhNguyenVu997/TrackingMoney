'use client';

import { useState } from 'react';
import { PriceChart } from '@/components/price-chart';
import { RecentTrades } from '@/components/recent-trades';
import { TopHolders } from '@/components/top-holders';

interface Props {
  chain: string;
  pairAddress: string;
}

const TABS = ['Chart', 'Trades', 'Holders'] as const;
type Tab = (typeof TABS)[number];

export function CoinDetailTabs({ chain, pairAddress }: Props) {
  const [tab, setTab] = useState<Tab>('Chart');

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-base font-semibold border-b-2 transition-colors ${
              t === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={tab === 'Chart' ? 'block' : 'hidden'}>
        <PriceChart chain={chain} pairAddress={pairAddress} />
      </div>
      <div className={tab === 'Trades' ? 'block' : 'hidden'}>
        <RecentTrades chain={chain} pairAddress={pairAddress} />
      </div>
      <div className={tab === 'Holders' ? 'block' : 'hidden'}>
        <TopHolders chain={chain} pairAddress={pairAddress} />
      </div>
    </div>
  );
}
