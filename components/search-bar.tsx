'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchPairs, type DexPair } from '@/lib/api';
import { Input } from '@/components/ui/input';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DexPair[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = v.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const reqId = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const data = await searchPairs(trimmed, 'solana');
      if (reqId !== reqIdRef.current) return;
      setResults(data);
      setOpen(true);
      setLoading(false);
      setActiveIdx(-1);
    }, 250);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pick(p: DexPair) {
    setOpen(false);
    setQuery('');
    router.push(`/coin/${p.chainId}/${p.pairAddress}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = results[activeIdx >= 0 ? activeIdx : 0];
      if (p) pick(p);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder="Search token or symbol..."
        value={query}
        onChange={onChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        className="pl-9"
      />
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-md shadow-lg max-h-96 overflow-auto">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No results</div>
          ) : (
            <ul>
              {results.map((p, i) => (
                <li key={p.pairAddress}>
                  <button
                    type="button"
                    className={`w-full text-left p-2 hover:bg-muted ${i === activeIdx ? 'bg-muted' : ''}`}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(p)}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.baseToken.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.baseToken.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm">
                          ${parseFloat(p.priceUsd ?? '0').toFixed(6)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${(p.volume?.h24 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} vol
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
