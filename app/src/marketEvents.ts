import type { JsonRpcClient, JsonRpcLog } from './rpcClient';

export const MARKET_EVENT_TOPICS = {
  convictionEntered: '0x353322d2c146d65e2ee3124ef29d1d2b3f9669b15efe89fdf0d538f6ddb19d01',
  convictionExited: '0xba77dfa256c3d657072ebc904d7f3d2e9b21ed8453447dc2b45a315eefcbcf8f',
  probabilityUpdated: '0x85018bec619abb6ce853de9daa190d054a9ede168962ca6c69eb70f17fe0d786',
  marketResolved: '0xacfe72f3cde40efc742b804309080aaca0b42008ab07b7522220a33ebb38095d',
} as const;

export type MarketHistoryEvent =
  | {
      kind: 'probability';
      market: `0x${string}`;
      txHash: `0x${string}`;
      blockNumber: bigint;
      logIndex: bigint;
      yesProbability: bigint;
      noProbability: bigint;
    }
  | {
      kind: 'enter' | 'exit';
      market: `0x${string}`;
      txHash: `0x${string}`;
      blockNumber: bigint;
      logIndex: bigint;
      user: `0x${string}`;
      outcome: 'yes' | 'no';
      amount: bigint;
      weight?: bigint;
      returnedAmount?: bigint;
      tax?: bigint;
    }
  | {
      kind: 'resolved';
      market: `0x${string}`;
      txHash: `0x${string}`;
      blockNumber: bigint;
      logIndex: bigint;
      winningOutcome: 'yes' | 'no';
    };

export type OutcomeCurvePoint = {
  blockNumber: bigint;
  txHash: `0x${string}`;
  yes: number;
  no: number;
};

export async function loadMarketHistory(
  client: JsonRpcClient,
  market: `0x${string}`,
  fromBlock: `0x${string}` | 'earliest' = 'earliest',
) {
  const logs = await client.ethGetLogs({
    address: market,
    fromBlock,
    toBlock: 'latest',
    topics: [[
      MARKET_EVENT_TOPICS.convictionEntered,
      MARKET_EVENT_TOPICS.convictionExited,
      MARKET_EVENT_TOPICS.probabilityUpdated,
      MARKET_EVENT_TOPICS.marketResolved,
    ]],
  });

  return logs
    .map(decodeMarketLog)
    .filter((event): event is MarketHistoryEvent => Boolean(event))
    .sort(compareEvents);
}

export function decodeMarketLog(log: JsonRpcLog): MarketHistoryEvent | undefined {
  const topic = log.topics[0]?.toLowerCase();
  const base = {
    market: log.address.toLowerCase() as `0x${string}`,
    txHash: log.transactionHash,
    blockNumber: BigInt(log.blockNumber),
    logIndex: BigInt(log.logIndex),
  };

  if (topic === MARKET_EVENT_TOPICS.probabilityUpdated) {
    const [yesProbability, noProbability] = decodeWords(log.data, 2);
    return { kind: 'probability', ...base, yesProbability, noProbability };
  }

  if (topic === MARKET_EVENT_TOPICS.convictionEntered) {
    const [outcome, amount, weight] = decodeWords(log.data, 3);
    return { kind: 'enter', ...base, user: topicAddress(log.topics[1]), outcome: decodeOutcome(outcome), amount, weight };
  }

  if (topic === MARKET_EVENT_TOPICS.convictionExited) {
    const [outcome, amount, returnedAmount, tax] = decodeWords(log.data, 4);
    return { kind: 'exit', ...base, user: topicAddress(log.topics[1]), outcome: decodeOutcome(outcome), amount, returnedAmount, tax };
  }

  if (topic === MARKET_EVENT_TOPICS.marketResolved) {
    const [winningOutcome] = decodeWords(log.data, 1);
    return { kind: 'resolved', ...base, winningOutcome: decodeOutcome(winningOutcome) };
  }
}

export function toOutcomeCurvePoints(events: MarketHistoryEvent[]): OutcomeCurvePoint[] {
  return events
    .filter((event): event is Extract<MarketHistoryEvent, { kind: 'probability' }> => event.kind === 'probability')
    .map((event) => ({
      blockNumber: event.blockNumber,
      txHash: event.txHash,
      yes: probabilityToPercent(event.yesProbability),
      no: probabilityToPercent(event.noProbability),
    }));
}

export function encodeTestWords(values: bigint[]) {
  return `0x${values.map((value) => value.toString(16).padStart(64, '0')).join('')}` as `0x${string}`;
}

function probabilityToPercent(value: bigint) {
  return Number((value * 10_000n) / 1_000_000_000_000_000_000n) / 100;
}

function decodeWords(data: `0x${string}`, count: number) {
  const body = data.startsWith('0x') ? data.slice(2) : data;
  return Array.from({ length: count }, (_, index) => {
    const word = body.slice(index * 64, index * 64 + 64);
    return BigInt(`0x${word || '0'}`);
  });
}

function decodeOutcome(value: bigint) {
  return value === 0n || value === 1n ? 'yes' : 'no';
}

function topicAddress(topic?: `0x${string}`) {
  if (!topic) return '0x0000000000000000000000000000000000000000';
  return `0x${topic.slice(-40)}` as `0x${string}`;
}

function compareEvents(left: MarketHistoryEvent, right: MarketHistoryEvent) {
  if (left.blockNumber < right.blockNumber) return -1;
  if (left.blockNumber > right.blockNumber) return 1;
  if (left.logIndex < right.logIndex) return -1;
  if (left.logIndex > right.logIndex) return 1;
  return 0;
}
