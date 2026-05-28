import { config } from './config';
import { claimDemoTokens, hasDemoJourneyConfig } from './demoJourney';
import type { EthereumProvider } from './wallet';

export type Outcome = 'yes' | 'no';
export type TradeMode = 'buy' | 'sell';

export type Balances = {
  collateral: bigint;
  pool0: bigint;
  pool1: bigint;
  yes: bigint;
  no: bigint;
};

export type TradeTarget = {
  marketAddress: `0x${string}`;
  yesTokenAddress: `0x${string}`;
  noTokenAddress: `0x${string}`;
};

export type ReceiptEvidence = {
  hash: `0x${string}`;
  poolSwap: boolean;
  hookObserved: boolean;
  marketEvent: boolean;
};

const ENTER_SELECTOR = '0x9d1a3a27';
const EXIT_SELECTOR = '0xd1b72e2f';
const APPROVE_SELECTOR = '0x095ea7b3';
const ALLOWANCE_SELECTOR = '0xdd62ed3e';
const BALANCE_OF_SELECTOR = '0x70a08231';
const MINT_SELECTOR = '0x40c10f19';
const MINT_POOL_TOKENS_SELECTOR = '0xaaf64a8e';

const MIN_SQRT_PRICE_PLUS_ONE = 4_295_128_740n;
const MAX_SQRT_PRICE_MINUS_ONE = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341n;
export const POOL_SWAP_AMOUNT = 100n;

const POOL_MANAGER_SWAP_TOPIC = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const HOOK_SWAP_OBSERVED_TOPIC = '0x9dff64abf697a4ba63fad8c5860123e8f64ec30c10898047e7db9ff48cde9b43';
const CONVICTION_ENTERED_TOPIC = '0x353322d2c146d65e2ee3124ef29d1d2b3f9669b15efe89fdf0d538f6ddb19d01';
const CONVICTION_EXITED_TOPIC = '0xba77dfa256c3d657072ebc904d7f3d2e9b21ed8453447dc2b45a315eefcbcf8f';

const ZERO_WORD = '0'.repeat(64);

export function hasDappConfig(target?: TradeTarget | null) {
  return Boolean(
    config.routerAddress &&
      config.hookAddress &&
      config.collateralToken &&
      config.demoPoolBootstrapper &&
      config.demoPoolCurrency0 &&
      config.demoPoolCurrency1 &&
      (target || (config.marketAddress && config.yesTokenAddress && config.noTokenAddress)),
  );
}

export async function readBalances(
  provider: EthereumProvider,
  account: `0x${string}`,
  target?: TradeTarget | null,
): Promise<Balances> {
  const tradeTarget = requireDappConfig(target);
  const [collateral, pool0, pool1, yes, no] = await Promise.all([
    readErc20Balance(provider, config.collateralToken!, account),
    readErc20Balance(provider, config.demoPoolCurrency0!, account),
    readErc20Balance(provider, config.demoPoolCurrency1!, account),
    readErc20Balance(provider, tradeTarget.yesTokenAddress, account),
    readErc20Balance(provider, tradeTarget.noTokenAddress, account),
  ]);
  return { collateral, pool0, pool1, yes, no };
}

export async function prepareDemoBalances(provider: EthereumProvider, account: `0x${string}`, amount: bigint) {
  requireDappConfig();
  if (hasDemoJourneyConfig()) {
    await claimDemoTokens(provider, account);
    return;
  }
  await sendAndWait(provider, account, config.collateralToken!, MINT_SELECTOR + encodeAddress(account) + encodeUint(amount));
  await sendAndWait(
    provider,
    account,
    config.demoPoolBootstrapper!,
    MINT_POOL_TOKENS_SELECTOR + encodeAddress(account) + encodeUint(POOL_SWAP_AMOUNT * 2n),
  );
}

export async function executeTrade(
  provider: EthereumProvider,
  account: `0x${string}`,
  target: TradeTarget,
  mode: TradeMode,
  outcome: Outcome,
  amount: bigint,
  onPhase: (phase: string) => void,
): Promise<ReceiptEvidence> {
  const tradeTarget = requireDappConfig(target);
  if (amount <= 0n) throw new DappError('INVALID_AMOUNT');

  onPhase('checking');
  const balances = await readBalances(provider, account, tradeTarget);
  const poolSide = selectPoolSwapSide(balances);
  const outcomeBalance = outcome === 'yes' ? balances.yes : balances.no;

  if (mode === 'buy' && balances.collateral < amount) throw new DappError('INSUFFICIENT_COLLATERAL');
  if (mode === 'sell' && outcomeBalance < amount) throw new DappError('INSUFFICIENT_OUTCOME');
  if (!poolSide) throw new DappError('INSUFFICIENT_POOL_TOKEN');

  if (mode === 'buy') {
    const collateralAllowance = await readAllowance(provider, config.collateralToken!, account, config.routerAddress!);
    if (collateralAllowance < amount) {
      onPhase('approvingCollateral');
      await approveExact(provider, account, config.collateralToken!, config.routerAddress!, amount);
    }
  }

  const poolAllowance = await readAllowance(provider, poolSide.token, account, config.routerAddress!);
  if (poolAllowance < POOL_SWAP_AMOUNT) {
    onPhase('approvingPoolToken');
    await approveExact(provider, account, poolSide.token, config.routerAddress!, POOL_SWAP_AMOUNT);
  }

  onPhase('submitting');
  const data =
    mode === 'buy'
      ? encodeEnterMarket(tradeTarget.marketAddress, outcome, amount, poolSide.zeroForOne)
      : encodeExitMarket(tradeTarget.marketAddress, outcome, amount, poolSide.zeroForOne);
  return sendAndWait(provider, account, config.routerAddress!, data, tradeTarget.marketAddress);
}

async function approveExact(
  provider: EthereumProvider,
  account: `0x${string}`,
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
) {
  await sendAndWait(provider, account, token, APPROVE_SELECTOR + encodeAddress(spender) + encodeUint(amount));
}

async function readErc20Balance(provider: EthereumProvider, token: `0x${string}`, account: `0x${string}`) {
  const result = await ethCall(provider, token, BALANCE_OF_SELECTOR + encodeAddress(account));
  return BigInt(result || '0x0');
}

async function readAllowance(
  provider: EthereumProvider,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
) {
  const result = await ethCall(provider, token, ALLOWANCE_SELECTOR + encodeAddress(owner) + encodeAddress(spender));
  return BigInt(result || '0x0');
}

async function ethCall(provider: EthereumProvider, to: `0x${string}`, data: string) {
  return provider.request<string>({ method: 'eth_call', params: [{ to, data }, 'latest'] });
}

async function sendAndWait(
  provider: EthereumProvider,
  from: `0x${string}`,
  to: `0x${string}`,
  data: string,
  marketAddress?: `0x${string}`,
): Promise<ReceiptEvidence> {
  const hash = await provider.request<`0x${string}`>({ method: 'eth_sendTransaction', params: [{ from, to, data }] });
  const receipt = await waitForReceipt(provider, hash);
  if (receipt.status && receipt.status !== '0x1') throw new DappError('TX_FAILED');

  return {
    hash,
    poolSwap: hasLog(receipt, config.poolManagerAddress, POOL_MANAGER_SWAP_TOPIC),
    hookObserved: hasLog(receipt, config.hookAddress, HOOK_SWAP_OBSERVED_TOPIC),
    marketEvent:
      hasLog(receipt, marketAddress, CONVICTION_ENTERED_TOPIC) ||
      hasLog(receipt, marketAddress, CONVICTION_EXITED_TOPIC),
  };
}

async function waitForReceipt(provider: EthereumProvider, hash: `0x${string}`) {
  for (;;) {
    const receipt = await provider.request<TransactionReceipt | null>({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}

function selectPoolSwapSide(balances: Balances) {
  if (balances.pool0 >= POOL_SWAP_AMOUNT) {
    return { token: config.demoPoolCurrency0!, zeroForOne: true };
  }
  if (balances.pool1 >= POOL_SWAP_AMOUNT) {
    return { token: config.demoPoolCurrency1!, zeroForOne: false };
  }
  return null;
}

function encodeEnterMarket(marketAddress: `0x${string}`, outcome: Outcome, amount: bigint, zeroForOne: boolean) {
  return ENTER_SELECTOR + encodeRouterArgs(marketAddress, zeroForOne, -POOL_SWAP_AMOUNT, sqrtLimitFor(zeroForOne), outcome, amount);
}

function encodeExitMarket(marketAddress: `0x${string}`, outcome: Outcome, amount: bigint, zeroForOne: boolean) {
  return EXIT_SELECTOR + encodeRouterArgs(marketAddress, zeroForOne, -POOL_SWAP_AMOUNT, sqrtLimitFor(zeroForOne), outcome, amount);
}

function sqrtLimitFor(zeroForOne: boolean) {
  return zeroForOne ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE;
}

function encodeRouterArgs(
  marketAddress: `0x${string}`,
  zeroForOne: boolean,
  amountSpecified: bigint,
  sqrtPriceLimitX96: bigint,
  outcome: Outcome,
  amount: bigint,
) {
  return [
    encodeAddress(config.demoPoolCurrency0!),
    encodeAddress(config.demoPoolCurrency1!),
    encodeUint(BigInt(config.demoPoolFee)),
    encodeInt(BigInt(config.demoPoolTickSpacing)),
    encodeAddress(config.hookAddress!),
    encodeBool(zeroForOne),
    encodeInt(amountSpecified),
    encodeUint(sqrtPriceLimitX96),
    encodeAddress(marketAddress),
    encodeUint(outcome === 'yes' ? 1n : 2n),
    encodeUint(amount),
  ].join('');
}

export function parseTokenAmount(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(trimmed)) throw new DappError('INVALID_AMOUNT');
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
}

export function formatTokenAmount(value: bigint, precision = 4) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, precision);
  return `${whole}.${fraction}`;
}

function encodeAddress(address: string) {
  return ZERO_WORD.slice(0, 24) + strip0x(address).toLowerCase();
}

function encodeUint(value: bigint) {
  if (value < 0n) throw new Error('negative uint');
  return value.toString(16).padStart(64, '0');
}

function encodeInt(value: bigint) {
  return value >= 0n ? encodeUint(value) : (2n ** 256n + value).toString(16).padStart(64, '0');
}

function encodeBool(value: boolean) {
  return encodeUint(value ? 1n : 0n);
}

function strip0x(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function requireDappConfig(target?: TradeTarget | null): TradeTarget {
  if (!hasDappConfig(target)) throw new DappError('MISSING_CONFIG');
  return target ?? {
    marketAddress: config.marketAddress!,
    yesTokenAddress: config.yesTokenAddress!,
    noTokenAddress: config.noTokenAddress!,
  };
}

function hasLog(receipt: TransactionReceipt, address: string | undefined, topic: string) {
  if (!address) return false;
  return receipt.logs.some(
    (log) => log.address.toLowerCase() === address.toLowerCase() && log.topics[0]?.toLowerCase() === topic,
  );
}

export class DappError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type TransactionReceipt = {
  status?: string;
  logs: Array<{
    address: string;
    topics: string[];
  }>;
};
