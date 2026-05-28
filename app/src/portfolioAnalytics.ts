import type { PortfolioPosition } from './portfolio';

export type PortfolioAnalytics = {
  totalPositionValue: bigint;
  totalClaimable: bigint;
  marketsCount: number;
  unrealizedPnl?: bigint;
  pnlKnown: boolean;
};

type PositionLike = Pick<PortfolioPosition, 'yesAmount' | 'noAmount' | 'claimable' | 'market'> & {
  costBasis?: bigint;
};

export function analyzePortfolio(positions: PositionLike[]): PortfolioAnalytics {
  const markets = new Set(positions.map((position) => position.market.address.toLowerCase()));
  const totalPositionValue = positions.reduce((sum, position) => sum + estimatePositionValue(position), 0n);
  const totalClaimable = positions.reduce((sum, position) => sum + position.claimable, 0n);
  const costBasisKnown = positions.length > 0 && positions.every((position) => typeof position.costBasis === 'bigint');
  const unrealizedPnl = costBasisKnown
    ? totalPositionValue - positions.reduce((sum, position) => sum + (position.costBasis ?? 0n), 0n)
    : undefined;

  return {
    totalPositionValue,
    totalClaimable,
    marketsCount: markets.size,
    unrealizedPnl,
    pnlKnown: costBasisKnown,
  };
}

export function estimatePositionValue(position: PositionLike) {
  const totalProbability = position.market.yesProbability + position.market.noProbability || 1n;
  const yesValue = (position.yesAmount * position.market.yesProbability) / totalProbability;
  const noValue = (position.noAmount * position.market.noProbability) / totalProbability;
  return yesValue + noValue + position.claimable;
}

export function hasVisiblePosition(position: PositionLike) {
  return position.yesAmount > 0n || position.noAmount > 0n || position.claimable > 0n;
}
