'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { getOHLCV, type Timeframe } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const TIMEFRAMES: { label: string; value: Timeframe; aggregate: number }[] = [
  { label: '5m', value: 'minute', aggregate: 5 },
  { label: '15m', value: 'minute', aggregate: 15 },
  { label: '1h', value: 'hour', aggregate: 1 },
  { label: '4h', value: 'hour', aggregate: 4 },
  { label: '1d', value: 'day', aggregate: 1 },
];

export function PriceChart({ chain, pairAddress }: { chain: string; pairAddress: string }) {
  const [tfIdx, setTfIdx] = useState(2);
  const tf = TIMEFRAMES[tfIdx];

  const { data, isFetching } = useQuery({
    queryKey: ['ohlcv', chain, pairAddress, tf.value, tf.aggregate],
    queryFn: () => getOHLCV(chain, pairAddress, tf.value, tf.aggregate, 200),
    refetchInterval: 60 * 1000,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !data) return;
    const candles: CandlestickData[] = data.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          Price chart
          {isFetching && data ? (
            <span className="text-xs text-muted-foreground font-normal animate-pulse">
              updating…
            </span>
          ) : null}
        </h2>
        <div className="flex gap-1">
          {TIMEFRAMES.map((t, i) => (
            <Button
              key={t.label}
              size="sm"
              variant={i === tfIdx ? 'default' : 'ghost'}
              onClick={() => setTfIdx(i)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative h-[400px] w-full">
        {!data ? <Skeleton className="absolute inset-0" /> : null}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </Card>
  );
}
