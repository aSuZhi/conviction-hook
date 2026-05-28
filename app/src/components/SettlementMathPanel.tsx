import { estimateClaim } from '../convictionAnalytics';
import { formatTokenAmount } from '../dapp';
import type { MarketSummary } from '../marketData';
import type { PortfolioPosition } from '../portfolio';

export function SettlementMathPanel({ market, position }: { market: MarketSummary; position?: PortfolioPosition }) {
  const userWeight = position ? position.yesWeight + position.noWeight : 0n;
  const estimatedClaim = estimateClaim(market.collateralPool, userWeight, userWeight);

  return (
    <section className="card settlement-panel">
      <p className="eyebrow">Settlement math</p>
      <h2>Shared collateral, weighted claim</h2>
      <dl>
        <dt>Distributable collateral</dt><dd>{formatTokenAmount(market.collateralPool, 2)} cUSDC</dd>
        <dt>Winning outcome</dt><dd>{market.resolved ? 'Resolved outcome' : 'Awaiting resolver'}</dd>
        <dt>User weight</dt><dd>{formatTokenAmount(userWeight, 2)}</dd>
        <dt>Claim formula</dt><dd>userWinningWeight / totalWinningWeight * distributableCollateral</dd>
        <dt>Estimated claim</dt><dd>{formatTokenAmount(estimatedClaim, 2)} cUSDC</dd>
      </dl>
    </section>
  );
}
