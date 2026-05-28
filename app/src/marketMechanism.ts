import type { JsonRpcClient } from './rpcClient';

export type MarketMechanismState = {
  marketId?: `0x${string}`;
  yesExposure: bigint;
  noExposure: bigint;
  totalYesWeight: bigint;
  totalNoWeight: bigint;
  createdAt?: bigint;
  winningOutcome?: 'yes' | 'no';
  resolvedCollateralPool?: bigint;
};

const selectors = {
  marketId: '0x6ed71ede',
  yesExposure: '0x005f7f28',
  noExposure: '0xf2f5170c',
  totalYesWeight: '0xd0bd83e5',
  totalNoWeight: '0xab227886',
  createdAt: '0xcf09e0d0',
  winningOutcome: '0x9b34ae03',
  resolvedCollateralPool: '0xa9677e87',
} as const;

export async function loadMarketMechanismState(client: JsonRpcClient, market: `0x${string}`): Promise<MarketMechanismState> {
  const [marketId, yesExposure, noExposure, totalYesWeight, totalNoWeight, createdAt, winningOutcome, resolvedCollateralPool] =
    await Promise.all([
      optionalCall(client, market, selectors.marketId),
      requiredUint(client, market, selectors.yesExposure),
      requiredUint(client, market, selectors.noExposure),
      requiredUint(client, market, selectors.totalYesWeight),
      requiredUint(client, market, selectors.totalNoWeight),
      optionalUint(client, market, selectors.createdAt),
      optionalUint(client, market, selectors.winningOutcome),
      optionalUint(client, market, selectors.resolvedCollateralPool),
    ]);

  return {
    marketId: marketId && marketId.length >= 66 ? (`0x${marketId.slice(-64)}` as `0x${string}`) : undefined,
    yesExposure,
    noExposure,
    totalYesWeight,
    totalNoWeight,
    createdAt,
    winningOutcome: winningOutcome === undefined ? undefined : winningOutcome === 0n || winningOutcome === 1n ? 'yes' : 'no',
    resolvedCollateralPool,
  };
}

async function requiredUint(client: JsonRpcClient, market: `0x${string}`, selector: string) {
  return decodeUint(await client.ethCall(market, selector));
}

async function optionalUint(client: JsonRpcClient, market: `0x${string}`, selector: string) {
  const result = await optionalCall(client, market, selector);
  return result ? decodeUint(result) : undefined;
}

async function optionalCall(client: JsonRpcClient, market: `0x${string}`, selector: string) {
  try {
    const result = await client.ethCall(market, selector);
    return result === '0x' ? undefined : result;
  } catch {
    return undefined;
  }
}

function decodeUint(hex: string) {
  return BigInt(hex || '0x0');
}
