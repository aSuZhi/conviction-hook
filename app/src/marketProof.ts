import { MARKET_EVENT_TOPICS, type MarketHistoryEvent } from './marketEvents';
import type { JsonRpcClient, JsonRpcReceipt } from './rpcClient';

export const PROOF_TOPICS = {
  poolManagerSwap: '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f',
  hookSwapObserved: '0x9dff64abf697a4ba63fad8c5860123e8f64ec30c10898047e7db9ff48cde9b43',
} as const;

export type ProofStatus = 'observed' | 'configured' | 'not-observed' | 'unavailable';

export type ProofStep = {
  status: ProofStatus;
  label: string;
  txHash?: `0x${string}`;
};

export type HookPathProof = {
  exactApproval: ProofStep;
  router: ProofStep;
  poolManager: ProofStep;
  hook: ProofStep;
  market: ProofStep;
};

export type HookPathProofConfig = {
  routerConfigured: boolean;
  poolManagerAddress?: `0x${string}`;
  hookAddress?: `0x${string}`;
  market: `0x${string}`;
};

export async function loadHookPathProof(
  client: JsonRpcClient,
  config: HookPathProofConfig,
  events: MarketHistoryEvent[],
) {
  const tradeEvents = events.filter((event) => event.kind === 'enter' || event.kind === 'exit');
  const hashes = [...new Set(tradeEvents.map((event) => event.txHash))].slice(-8);
  const receipts = (await Promise.all(hashes.map((hash) => client.ethGetTransactionReceipt(hash)))).filter(
    (receipt): receipt is JsonRpcReceipt => Boolean(receipt),
  );
  return buildHookPathProof({ ...config, receipts });
}

export function buildHookPathProof(input: HookPathProofConfig & { receipts: Pick<JsonRpcReceipt, 'transactionHash' | 'logs'>[] }): HookPathProof {
  const firstReceipt = input.receipts[0];
  const poolHash = receiptHash(input.receipts, (log) => sameAddress(log.address, input.poolManagerAddress) && hasTopic(log.topics, PROOF_TOPICS.poolManagerSwap));
  const hookHash = receiptHash(input.receipts, (log) => sameAddress(log.address, input.hookAddress) && hasTopic(log.topics, PROOF_TOPICS.hookSwapObserved));
  const marketHash = receiptHash(
    input.receipts,
    (log) =>
      sameAddress(log.address, input.market) &&
      (hasTopic(log.topics, MARKET_EVENT_TOPICS.convictionEntered) || hasTopic(log.topics, MARKET_EVENT_TOPICS.convictionExited)),
  );

  return {
    exactApproval: { label: 'Exact approval', status: firstReceipt ? 'observed' : 'not-observed', txHash: firstReceipt?.transactionHash },
    router: { label: 'ConvictionRouter trade', status: input.routerConfigured ? 'configured' : 'not-observed' },
    poolManager: { label: 'PoolManager.swap', status: poolHash ? 'observed' : 'not-observed', txHash: poolHash },
    hook: { label: 'ConvictionHook lifecycle check', status: hookHash ? 'observed' : 'not-observed', txHash: hookHash },
    market: { label: 'ConvictionMarket accounting', status: marketHash ? 'observed' : 'not-observed', txHash: marketHash },
  };
}

function receiptHash(receipts: Pick<JsonRpcReceipt, 'transactionHash' | 'logs'>[], predicate: (log: { address: string; topics?: string[] }) => boolean) {
  return receipts.find((receipt) => receipt.logs.some(predicate))?.transactionHash;
}

function hasTopic(topics: string[] | undefined, topic: string) {
  return Boolean(topics?.some((candidate) => candidate.toLowerCase() === topic.toLowerCase()));
}

function sameAddress(left: string, right?: string) {
  return Boolean(right && left.toLowerCase() === right.toLowerCase());
}
