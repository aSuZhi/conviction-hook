import { useEffect, useMemo, useState } from 'react';
import { formatTokenAmount } from '../dapp';
import { filterMarkets, getMarketLifecycle, sortMarkets, type MarketSortMode } from '../marketAnalytics';
import type { MarketSummary } from '../marketData';
import type { PortfolioPosition } from '../portfolio';
import type { AppRoute } from '../routes';
import type { AppCopy } from '../i18n';
import { MarketCard } from './MarketCard';
import { MarketFilterBar, type MarketFilter } from './MarketFilterBar';
import { MarketCardSkeletons } from './Skeletons';
import { StatusState } from './StatusState';

export function MarketDiscoveryPage({
  markets,
  positions,
  loadState,
  search,
  copy,
  onNavigate,
  onRetry,
}: {
  markets: MarketSummary[];
  positions: PortfolioPosition[];
  loadState: 'demo' | 'loading' | 'live' | 'error';
  search: string;
  copy: AppCopy['marketCard'];
  onNavigate: (route: AppRoute) => void;
  onRetry: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<MarketFilter>('bettable');
  const [sort, setSort] = useState<MarketSortMode>('hot');
  const [loadingExpired, setLoadingExpired] = useState(false);
  const ownedMarketAddresses = useMemo(
    () =>
      new Set(
        positions
          .filter((position) => position.yesAmount > 0n || position.noAmount > 0n || position.claimable > 0n)
          .map((position) => position.market.address.toLowerCase()),
      ),
    [positions],
  );
  const visibleMarkets = sortMarkets(filterMarkets(markets, filter, search, ownedMarketAddresses), sort);
  const initialLoading = loadState === 'loading' && markets.length === 0 && !loadingExpired;
  const rpcUnavailable = loadState === 'error' || (loadState === 'loading' && markets.length === 0 && loadingExpired);

  useEffect(() => {
    if (loadState !== 'loading' || markets.length > 0) {
      setLoadingExpired(false);
      return;
    }

    const timer = window.setTimeout(() => setLoadingExpired(true), 3_500);
    return () => window.clearTimeout(timer);
  }, [loadState, markets.length]);

  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Live event assets</p>
          <h1>Markets ready for conviction</h1>
          <p>Only bettable markets are shown by default. Paused, voided, resolved, and expired markets never appear open for betting.</p>
        </div>
        <div className="hero-stats">
          <span>{initialLoading ? 'Loading' : `${visibleMarkets.length} visible`}</span>
          <span>{initialLoading ? 'X Layer RPC' : `${markets.filter((market) => getMarketLifecycle(market) === 'bettable').length} bettable`}</span>
        </div>
      </header>
      <MarketFilterBar filter={filter} sort={sort} onFilterChange={setFilter} onSortChange={setSort} />
      {initialLoading ? <MarketCardSkeletons /> : null}
      {rpcUnavailable ? (
        <StatusState title="RPC error" body="Market data could not be loaded from the configured X Layer RPC." actionLabel="Retry" onAction={onRetry} />
      ) : null}
      {!initialLoading && !rpcUnavailable && visibleMarkets.length === 0 ? (
        <StatusState
          title={search ? 'No matching markets' : 'No bettable markets'}
          body={search ? 'Clear the search or change filters.' : 'There are no active markets ready for betting right now.'}
          actionLabel="View portfolio"
          onAction={() => onNavigate({ kind: 'portfolio' })}
        />
      ) : null}
      <div className="markets-view">
        {visibleMarkets.map((market) => (
          <MarketCard
            key={market.address}
            title={market.question}
            yesProbability={Number(market.yesProbability) / 1e16}
            noProbability={Number(market.noProbability) / 1e16}
            poolSize={`${formatTokenAmount(market.collateralPool, 2)} cUSDC`}
            deadline={formatDeadline(market.deadline)}
            status={market.status}
            lifecycle={market.lifecycle}
            copy={copy}
            onSelect={() => onNavigate({ kind: 'marketDetail', marketAddress: market.address })}
            onChooseYes={() => onNavigate({ kind: 'marketDetail', marketAddress: market.address, outcome: 'yes' })}
            onChooseNo={() => onNavigate({ kind: 'marketDetail', marketAddress: market.address, outcome: 'no' })}
          />
        ))}
      </div>
    </section>
  );
}

function formatDeadline(deadline: bigint) {
  return new Date(Number(deadline) * 1000).toLocaleString();
}
