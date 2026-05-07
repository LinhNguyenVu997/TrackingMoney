import WebSocket from 'ws';
import { config } from './config.js';

const WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;

export type SignatureHandler = (pool: string, signature: string, err: unknown) => void;

export class HeliusStream {
  private ws: WebSocket | null = null;
  private nextReqId = 1;
  private handler: SignatureHandler;
  private pending = new Map<number, string>();
  private subToPool = new Map<number, string>();
  private wantedPools = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(handler: SignatureHandler) {
    this.handler = handler;
  }

  connect() {
    console.log('[helius] connecting...');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.on('open', () => {
      console.log('[helius] connected');
      this.subToPool.clear();
      this.pending.clear();
      for (const pool of this.wantedPools) this.sendSubscribe(pool);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          method?: string;
          id?: number;
          result?: unknown;
          error?: unknown;
          params?: {
            subscription?: number;
            result?: { value?: { signature?: string; err?: unknown } };
          };
        };

        if (msg.method === 'logsNotification') {
          const subId = msg.params?.subscription;
          const value = msg.params?.result?.value;
          const pool = subId !== undefined ? this.subToPool.get(subId) : undefined;
          if (pool && value?.signature) {
            this.handler(pool, value.signature, value.err);
          }
        } else if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
          const pool = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (typeof msg.result === 'number') {
            this.subToPool.set(msg.result, pool);
            console.log(`[helius] subscribed pool=${pool.slice(0, 8)}... sub=${msg.result}`);
          } else {
            console.error(`[helius] subscribe failed pool=${pool}`, msg.error);
          }
        }
      } catch (e) {
        console.error('[helius] parse error', e);
      }
    });

    ws.on('error', (err) => console.error('[helius] ws error', (err as Error).message));

    ws.on('close', () => {
      console.log('[helius] disconnected, reconnecting in 3s');
      this.ws = null;
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 3000);
      }
    });
  }

  resubscribe(pools: string[]) {
    const next = new Set(pools);
    for (const [subId, pool] of this.subToPool) {
      if (!next.has(pool)) {
        this.sendUnsubscribe(subId);
        this.subToPool.delete(subId);
      }
    }
    const currentPools = new Set(this.subToPool.values());
    for (const pool of pools) {
      if (!currentPools.has(pool)) this.sendSubscribe(pool);
    }
    this.wantedPools = next;
  }

  private sendSubscribe(pool: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const id = this.nextReqId++;
    this.pending.set(id, pool);
    this.ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'logsSubscribe',
        params: [{ mentions: [pool] }, { commitment: 'confirmed' }],
      })
    );
  }

  private sendUnsubscribe(subId: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextReqId++,
        method: 'logsUnsubscribe',
        params: [subId],
      })
    );
  }
}
