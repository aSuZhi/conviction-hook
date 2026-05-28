import { config } from './config';
import type { EthereumProvider } from './wallet';

export type StudioReceipt = {
  hash: `0x${string}`;
  createdMarket?: `0x${string}`;
};

const CREATE_MARKET_SELECTOR = '0xf49289fc';
const REGISTER_MARKET_SELECTOR = '0xa79b9ec9';
const SET_OUTCOME_SELECTOR = '0xca7e88ba';
const RESOLVE_SELECTOR = '0x2810e1d6';
const MARKET_ID_SELECTOR = '0x6ed71ede';
const MANAGER_PAUSE_SELECTOR = '0xe952cba9';
const MANAGER_UNPAUSE_SELECTOR = '0x9980517e';
const MANAGER_VOID_SELECTOR = '0x7f34e314';
const MANAGER_EARLY_RESOLVE_SELECTOR = '0xca2f9f0e';
const MARKET_CREATED_TOPIC = '0xa85914401d9742d89d21d895b5dad653399bc816481dc54b057a10d8778d7311';

const WORD = 64;

export async function createMarket(
  provider: EthereumProvider,
  question: string,
  collateralToken: `0x${string}`,
  resolver: `0x${string}`,
  deadline: bigint,
  maxCollateral: bigint,
) {
  requireAddress(config.factoryAddress, 'Factory');
  const receipt = await sendAndWait(
    provider,
    config.factoryAddress!,
    CREATE_MARKET_SELECTOR + encodeCreateMarketArgs(question, collateralToken, resolver, deadline, maxCollateral),
  );
  return { hash: receipt.hash, createdMarket: findCreatedMarket(receipt) } satisfies StudioReceipt;
}

export async function registerMarket(provider: EthereumProvider, market: `0x${string}`) {
  requireAddress(config.hookAddress, 'Hook');
  const hash = await sendAndWait(provider, config.hookAddress!, REGISTER_MARKET_SELECTOR + encodeAddress(market));
  return { hash: hash.hash } satisfies StudioReceipt;
}

export async function setOutcome(
  provider: EthereumProvider,
  resolver: `0x${string}`,
  marketId: `0x${string}`,
  outcome: 'yes' | 'no',
) {
  const hash = await sendAndWait(provider, resolver, SET_OUTCOME_SELECTOR + encodeBytes32(marketId) + encodeUint(outcome === 'yes' ? 1n : 2n));
  return { hash: hash.hash } satisfies StudioReceipt;
}

export async function resolveMarket(provider: EthereumProvider, market: `0x${string}`) {
  const hash = await sendAndWait(provider, market, RESOLVE_SELECTOR);
  return { hash: hash.hash } satisfies StudioReceipt;
}

export async function pauseMarket(provider: EthereumProvider, market: `0x${string}`) {
  requireAddress(config.managerAddress, 'Manager');
  const receipt = await sendAndWait(provider, config.managerAddress!, MANAGER_PAUSE_SELECTOR + encodeAddress(market));
  return { hash: receipt.hash } satisfies StudioReceipt;
}

export async function unpauseMarket(provider: EthereumProvider, market: `0x${string}`) {
  requireAddress(config.managerAddress, 'Manager');
  const receipt = await sendAndWait(provider, config.managerAddress!, MANAGER_UNPAUSE_SELECTOR + encodeAddress(market));
  return { hash: receipt.hash } satisfies StudioReceipt;
}

export async function voidMarket(provider: EthereumProvider, market: `0x${string}`, evidenceURI: string) {
  requireAddress(config.managerAddress, 'Manager');
  const receipt = await sendAndWait(
    provider,
    config.managerAddress!,
    MANAGER_VOID_SELECTOR + encodeAddress(market) + encodeUint(64n) + encodeString(evidenceURI),
  );
  return { hash: receipt.hash } satisfies StudioReceipt;
}

export async function earlyResolveMarket(
  provider: EthereumProvider,
  market: `0x${string}`,
  outcome: 'yes' | 'no',
  evidenceURI: string,
) {
  requireAddress(config.managerAddress, 'Manager');
  const receipt = await sendAndWait(
    provider,
    config.managerAddress!,
    MANAGER_EARLY_RESOLVE_SELECTOR +
      encodeAddress(market) +
      encodeUint(outcome === 'yes' ? 1n : 2n) +
      encodeUint(96n) +
      encodeString(evidenceURI),
  );
  return { hash: receipt.hash } satisfies StudioReceipt;
}

export async function readMarketId(provider: EthereumProvider, market: `0x${string}`) {
  return provider.request<`0x${string}`>({ method: 'eth_call', params: [{ to: market, data: MARKET_ID_SELECTOR }, 'latest'] });
}

async function sendAndWait(provider: EthereumProvider, to: `0x${string}`, data: string): Promise<TransactionReceipt> {
  const hash = await provider.request<`0x${string}`>({ method: 'eth_sendTransaction', params: [{ to, data }] });
  for (;;) {
    const receipt = await provider.request<TransactionReceipt | null>({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') throw new Error('Transaction reverted');
      return { ...receipt, hash };
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}

function encodeCreateMarketArgs(
  question: string,
  collateralToken: `0x${string}`,
  resolver: `0x${string}`,
  deadline: bigint,
  maxCollateral: bigint,
) {
  const encodedQuestion = encodeString(question);
  return [
    encodeUint(5n * 32n),
    encodeAddress(collateralToken),
    encodeAddress(resolver),
    encodeUint(deadline),
    encodeUint(maxCollateral),
    encodedQuestion,
  ].join('');
}

function encodeString(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const body = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return encodeUint(BigInt(bytes.length)) + body.padEnd(Math.ceil(body.length / WORD) * WORD, '0');
}

function encodeBytes32(value: `0x${string}`) {
  const stripped = strip0x(value);
  if (stripped.length !== WORD) throw new Error('Expected bytes32 value');
  return stripped;
}

function encodeAddress(address: string) {
  return '0'.repeat(24) + strip0x(address).toLowerCase();
}

function encodeUint(value: bigint) {
  if (value < 0n) throw new Error('Negative uint');
  return value.toString(16).padStart(WORD, '0');
}

function strip0x(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function requireAddress(value: unknown, label: string): asserts value is `0x${string}` {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} address is not configured`);
}

function findCreatedMarket(receipt: TransactionReceipt) {
  const log = receipt.logs.find(
    (item) =>
      item.address.toLowerCase() === config.factoryAddress?.toLowerCase() &&
      item.topics[0]?.toLowerCase() === MARKET_CREATED_TOPIC,
  );
  if (!log?.topics[1]) return undefined;
  return `0x${log.topics[1].slice(-40)}` as `0x${string}`;
}

type TransactionReceipt = {
  hash: `0x${string}`;
  status?: string;
  logs: Array<{
    address: string;
    topics: string[];
  }>;
};
