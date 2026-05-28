import { useMemo, useState } from 'react';
import type { PortfolioPosition } from '../portfolio';
import { analyzePortfolio, hasVisiblePosition } from '../portfolioAnalytics';
import type { AppRoute } from '../routes';
import { PortfolioPositionsTable } from './PortfolioPositionsTable';
import { PortfolioSummary } from './PortfolioSummary';
import { StatusState } from './StatusState';

export function PortfolioPage({
  positions,
  busy,
  onClaim,
  onNavigate,
}: {
  positions: PortfolioPosition[];
  busy?: boolean;
  onClaim: (position: PortfolioPosition) => Promise<void>;
  onNavigate: (route: AppRoute) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'active' | 'claimable' | 'resolved' | 'profit' | 'loss'>('all');
  const visiblePositions = useMemo(
    () =>
      positions.filter((position) => {
        if (!hasVisiblePosition(position)) return false;
        if (filter === 'claimable') return position.claimable > 0n;
        if (filter === 'resolved') return position.market.resolved;
        if (filter === 'active') return position.market.lifecycle === 'bettable';
        return true;
      }),
    [filter, positions],
  );
  const analytics = analyzePortfolio(visiblePositions);

  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Your conviction positions</h1>
          <p>Position value, claimable collateral, and honest PnL state. PnL is only shown when cost basis exists.</p>
        </div>
      </header>
      <PortfolioSummary analytics={analytics} />
      <div className="filter-tabs">
        {(['all', 'active', 'claimable', 'resolved', 'profit', 'loss'] as const).map((value) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>
        ))}
      </div>
      {visiblePositions.length === 0 ? (
        <StatusState title="No portfolio rows" body="No positions match this filter." actionLabel="Browse markets" onAction={() => onNavigate({ kind: 'markets' })} />
      ) : null}
      <PortfolioPositionsTable positions={visiblePositions} busy={busy} onClaim={onClaim} />
    </section>
  );
}
