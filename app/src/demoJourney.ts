import { config } from './config';
import type { EthereumProvider } from './wallet';

export type DemoOutcome = 'yes' | 'no';

export type DemoJourneyReceipt = {
  hash: `0x${string}`;
};

export type DemoSettlementGateMarket = {
  resolved: boolean;
  lifecycle: string;
} | null | undefined;

const CLAIM_DEMO_TOKENS_SELECTOR = '0x498da513';
const START_DEMO_SESSION_SELECTOR = '0x37d66a19';
const SETTLE_DEMO_MARKET_SELECTOR = '0x4b44db41';
const NEXT_CLAIM_AT_SELECTOR = '0x11a163e9';
const DEMO_MARKET_SELECTOR = '0xe261bdd7';
const DEMO_MARKET_OF_SELECTOR = '0x95a449a2';
const CLAIM_AMOUNT_SELECTOR = '0x830953ab';
const POOL_TOKEN_AMOUNT_SELECTOR = '0xd501953d';
const WORD_HEX_LENGTH = 64;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function hasDemoJourneyConfig() {
  return isAddress(config.demoJourneyController);
}

export async function claimDemoTokens(provider: EthereumProvider, account: `0x${string}`): Promise<DemoJourneyReceipt> {
  const controller = requireDemoJourneyController();
  return sendAndWait(provider, account, controller, CLAIM_DEMO_TOKENS_SELECTOR);
}

export async function startDemoSession(provider: EthereumProvider, account: `0x${string}`): Promise<DemoJourneyReceipt> {
  const controller = requireDemoJourneyController();
  return sendAndWait(provider, account, controller, START_DEMO_SESSION_SELECTOR);
}

export async function settleDemoMarket(
  provider: EthereumProvider,
  account: `0x${string}`,
  outcome: DemoOutcome,
  evidenceURI = 'demo://user-triggered-settlement',
): Promise<DemoJourneyReceipt> {
  const controller = requireDemoJourneyController();
  return sendAndWait(provider, account, controller, encodeSettleDemoMarketData(outcome, evidenceURI));
}

export async function readNextClaimAt(provider: EthereumProvider, account: `0x${string}`) {
  const controller = requireDemoJourneyController();
  const result = await ethCall(provider, controller, NEXT_CLAIM_AT_SELECTOR + encodeAddress(account));
  return decodeUint(result);
}

export async function readDemoMarket(provider: EthereumProvider) {
  const controller = requireDemoJourneyController();
  const result = await ethCall(provider, controller, DEMO_MARKET_SELECTOR);
  return decodeAddress(result);
}

export async function readUserDemoMarket(provider: EthereumProvider, account: `0x${string}`) {
  const controller = requireDemoJourneyController();
  const result = await ethCall(provider, controller, DEMO_MARKET_OF_SELECTOR + encodeAddress(account));
  return decodeAddress(result);
}

export async function readDemoJourneyAmounts(provider: EthereumProvider) {
  const controller = requireDemoJourneyController();
  const [claimAmount, poolTokenAmount] = await Promise.all([
    ethCall(provider, controller, CLAIM_AMOUNT_SELECTOR).then(decodeUint),
    ethCall(provider, controller, POOL_TOKEN_AMOUNT_SELECTOR).then(decodeUint),
  ]);
  return { claimAmount, poolTokenAmount };
}

export function encodeOutcome(outcome: DemoOutcome) {
  return outcome === 'yes' ? 1n : 2n;
}

export function canUserSettleDemoMarket({
  connected,
  controllerReady,
  hasPosition,
  market,
}: {
  connected: boolean;
  controllerReady: boolean;
  hasPosition: boolean;
  market: DemoSettlementGateMarket;
}) {
  return Boolean(
    connected &&
      controllerReady &&
      hasPosition &&
      market &&
      !market.resolved &&
      market.lifecycle === 'bettable',
  );
}

export function isActiveDemoSessionMarket(market: DemoSettlementGateMarket) {
  return Boolean(market && !market.resolved && market.lifecycle === 'bettable');
}

export function needsNewDemoSession(market: DemoSettlementGateMarket) {
  return !isActiveDemoSessionMarket(market);
}

export function encodeSettleDemoMarketData(outcome: DemoOutcome, evidenceURI: string) {
  return SETTLE_DEMO_MARKET_SELECTOR + encodeUint(encodeOutcome(outcome)) + encodeUint(64n) + encodeStringBody(evidenceURI);
}

async function ethCall(provider: EthereumProvider, to: `0x${string}`, data: string) {
  return provider.request<string>({ method: 'eth_call', params: [{ to, data }, 'latest'] });
}

async function sendAndWait(
  provider: EthereumProvider,
  from: `0x${string}`,
  to: `0x${string}`,
  data: string,
): Promise<DemoJourneyReceipt> {
  const hash = await provider.request<`0x${string}`>({ method: 'eth_sendTransaction', params: [{ from, to, data }] });
  const receipt = await waitForReceipt(provider, hash);
  if (receipt.status && receipt.status !== '0x1') throw new Error('Transaction reverted');
  return { hash };
}

async function waitForReceipt(provider: EthereumProvider, hash: `0x${string}`) {
  for (;;) {
    const receipt = await provider.request<{ status?: string } | null>({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function requireDemoJourneyController() {
  if (!hasDemoJourneyConfig()) throw new DemoJourneyError('MISSING_DEMO_CONTROLLER');
  return config.demoJourneyController;
}

function encodeStringBody(value: string) {
  const bytes = new TextEncoder().encode(value);
  const data = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return encodeUint(BigInt(bytes.length)) + data.padEnd(Math.ceil(data.length / WORD_HEX_LENGTH) * WORD_HEX_LENGTH, '0');
}

function encodeAddress(address: string) {
  return '0'.repeat(24) + strip0x(address).toLowerCase();
}

function encodeUint(value: bigint) {
  if (value < 0n) throw new Error('negative uint');
  return value.toString(16).padStart(WORD_HEX_LENGTH, '0');
}

function decodeUint(hex: string) {
  const body = strip0x(hex || '0x0');
  return BigInt(`0x${body || '0'}`);
}

function decodeAddress(hex: string): `0x${string}` {
  const body = strip0x(hex || ZERO_ADDRESS).padStart(WORD_HEX_LENGTH, '0');
  return `0x${body.slice(-40)}` as `0x${string}`;
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function strip0x(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

export class DemoJourneyError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
