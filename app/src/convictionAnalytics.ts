import type { MarketSummary } from './marketData';
import type { MarketMechanismState } from './marketMechanism';
import type { PortfolioPosition } from './portfolio';

export type ConvictionMechanismSnapshot = {
  market: `0x${string}`;
  yesConvictionWeight?: bigint;
  noConvictionWeight?: bigint;
  userConvictionWeight?: bigint;
  earlyEntryMultiplier?: number;
  holdingTimeMultiplier?: number;
  contrarianMultiplier?: number;
  baseExitTaxBps?: number;
  timeExitTaxBps?: number;
  imbalanceExitTaxBps?: number;
  currentExitTaxBps?: number;
  analyticsKnown: boolean;
};

export type ConvictionSnapshotInput = {
  market: MarketSummary;
  mechanism?: MarketMechanismState;
  position?: PortfolioPosition;
  now?: number;
};

export function buildConvictionSnapshot(input: ConvictionSnapshotInput): ConvictionMechanismSnapshot {
  const mechanism = input.mechanism;
  const userConvictionWeight = input.position ? input.position.yesWeight + input.position.noWeight : undefined;

  return {
    market: input.market.address,
    yesConvictionWeight: mechanism?.totalYesWeight,
    noConvictionWeight: mechanism?.totalNoWeight,
    userConvictionWeight,
    earlyEntryMultiplier: mechanism?.createdAt
      ? estimateEarlyEntryMultiplier(input.market.deadline, mechanism.createdAt, input.now ?? Date.now() / 1000)
      : undefined,
    holdingTimeMultiplier: undefined,
    contrarianMultiplier: undefined,
    baseExitTaxBps: undefined,
    timeExitTaxBps: undefined,
    imbalanceExitTaxBps: undefined,
    currentExitTaxBps: undefined,
    analyticsKnown: Boolean(mechanism),
  };
}

export function buildFallbackConvictionSnapshot(market: `0x${string}`): ConvictionMechanismSnapshot {
  return {
    market,
    analyticsKnown: false,
  };
}

export function estimateClaim(distributableCollateral: bigint, userWinningWeight: bigint, totalWinningWeight: bigint) {
  if (totalWinningWeight === 0n) return 0n;
  return (distributableCollateral * userWinningWeight) / totalWinningWeight;
}

export function convictionShare(yesWeight?: bigint, noWeight?: bigint) {
  const yes = yesWeight ?? 0n;
  const no = noWeight ?? 0n;
  const total = yes + no;
  if (total === 0n) return { yes: 50, no: 50, known: false };
  const yesShare = Number((yes * 10000n) / total) / 100;
  return { yes: yesShare, no: 100 - yesShare, known: true };
}

export function formatBps(value?: number) {
  return typeof value === 'number' ? `${(value / 100).toFixed(2)}%` : 'Unavailable';
}

export function formatMultiplier(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(2)}x` : 'Awaiting data';
}

function estimateEarlyEntryMultiplier(deadline: bigint, createdAt: bigint, now: number) {
  const duration = Number(deadline - createdAt);
  if (duration <= 0) return 1;
  const elapsed = Math.max(0, Math.min(duration, now - Number(createdAt)));
  return Number((1.5 - (elapsed / duration) * 0.5).toFixed(2));
}
