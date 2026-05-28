import { formatTokenAmount } from '../dapp';
import type { PortfolioAnalytics } from '../portfolioAnalytics';

export function PortfolioSummary({ analytics }: { analytics: PortfolioAnalytics }) {
  return (
    <section className="summary-grid">
      <Metric label="Total position value" value={`${formatTokenAmount(analytics.totalPositionValue, 2)} cUSDC`} />
      <Metric label="Unrealized PnL" value={analytics.pnlKnown && analytics.unrealizedPnl !== undefined ? `${formatTokenAmount(analytics.unrealizedPnl, 2)} cUSDC` : 'PnL unavailable until trade history syncs'} />
      <Metric label="Claimable" value={`${formatTokenAmount(analytics.totalClaimable, 2)} cUSDC`} />
      <Metric label="Markets" value={String(analytics.marketsCount)} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
