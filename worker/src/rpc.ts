import { config } from './config.js';

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;

export async function getTransaction(signature: string): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`getTransaction HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: unknown };
  if (json.error) throw new Error(`getTransaction RPC: ${JSON.stringify(json.error)}`);
  return json.result;
}
