export type JsonRpcLog = {
  address: `0x${string}`;
  blockNumber: `0x${string}`;
  transactionHash: `0x${string}`;
  transactionIndex?: `0x${string}`;
  blockHash?: `0x${string}`;
  logIndex: `0x${string}`;
  removed?: boolean;
  data: `0x${string}`;
  topics: `0x${string}`[];
};

export type JsonRpcReceipt = {
  transactionHash: `0x${string}`;
  blockNumber?: `0x${string}`;
  status?: `0x${string}`;
  logs: JsonRpcLog[];
};

export type JsonRpcLogFilter = {
  address?: `0x${string}` | `0x${string}`[];
  fromBlock?: `0x${string}` | 'earliest' | 'latest';
  toBlock?: `0x${string}` | 'earliest' | 'latest';
  topics?: (`0x${string}` | `0x${string}`[] | null)[];
};

type JsonRpcClientOptions = {
  minIntervalMs?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
};

export function createJsonRpcClient(rpcUrl: string, options: JsonRpcClientOptions = {}) {
  const minIntervalMs = options.minIntervalMs ?? 120;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maxConcurrency = options.maxConcurrency ?? 8;
  const waiters: (() => void)[] = [];
  let activeRequests = 0;
  let nextStartAt = 0;

  async function request<T>(method: string, params: unknown[]): Promise<T> {
    await acquireRequestSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') throw new Error('Invalid JSON-RPC payload');
      if ('error' in payload && payload.error) throw new Error(formatRpcError(payload.error));
      if (!('result' in payload)) throw new Error('JSON-RPC response missing result');
      return payload.result as T;
    } finally {
      clearTimeout(timeout);
      releaseRequestSlot();
    }
  }

  async function acquireRequestSlot() {
    if (activeRequests >= maxConcurrency) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }

    activeRequests += 1;
    const now = Date.now();
    const delay = Math.max(0, nextStartAt - now);
    nextStartAt = Math.max(now, nextStartAt) + minIntervalMs;
    if (delay > 0) await sleep(delay);
  }

  function releaseRequestSlot() {
    activeRequests = Math.max(0, activeRequests - 1);
    const next = waiters.shift();
    if (next) next();
  }

  return {
    ethCall(to: `0x${string}`, data: string, block: string = 'latest') {
      return request<string>('eth_call', [{ to, data }, block]);
    },
    ethGetLogs(filter: JsonRpcLogFilter) {
      return request<JsonRpcLog[]>('eth_getLogs', [filter]);
    },
    ethGetTransactionReceipt(hash: `0x${string}`) {
      return request<JsonRpcReceipt | null>('eth_getTransactionReceipt', [hash]);
    },
    ethBlockNumber() {
      return request<`0x${string}`>('eth_blockNumber', []);
    },
  };
}

export type JsonRpcClient = ReturnType<typeof createJsonRpcClient>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRpcError(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
