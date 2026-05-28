import { useMemo, useState } from 'react';
import type { AppCopy } from '../i18n';
import type { MarketSummary } from '../marketData';
import type { PortfolioPosition } from '../portfolio';
import { MarketCard } from './MarketCard';

export function MarketsView({
  markets,
  selectedMarket,
  onSelectMarket,
  positions = [],
  copy,
}: {
  markets: MarketSummary[];
  selectedMarket: MarketSummary | null;
  onSelectMarket: (market: MarketSummary) => void;
  positions?: PortfolioPosition[];
  copy: AppCopy['marketCard'];
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'resolved' | 'mine'>('all');
  const marketsWithPositions = useMemo(
    () =>
      new Set(
        positions
          .filter((position) => position.yesAmount > 0n || position.noAmount > 0n || position.claimable > 0n)
          .map((position) => position.market.address.toLowerCase()),
      ),
    [positions],
  );
  const filteredMarkets = markets.filter((market) => {
    const matchesQuery = market.question.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      market.status === filter ||
      (filter === 'mine' && marketsWithPositions.has(market.address.toLowerCase()));
    return matchesQuery && matchesFilter;
  });

  if (markets.length === 0) return null;

  return (
    <section className="markets-section">
      <div className="market-tools">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
        <div className="filter-tabs">
          {(['all', 'active', 'expired', 'resolved', 'mine'] as const).map((value) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {copy.filters[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="markets-view">
        {filteredMarkets.map((market) => (
          <MarketCard
            key={market.address}
            title={market.question}
            yesProbability={Number(market.yesProbability) / 1e16}
            noProbability={Number(market.noProbability) / 1e16}
            poolSize={`${formatTokenAmount(market.collateralPool)} cUSDC`}
            deadline={formatDeadline(market.deadline)}
            selected={selectedMarket?.address.toLowerCase() === market.address.toLowerCase()}
            status={market.status}
            copy={copy}
            onSelect={() => onSelectMarket(market)}
          />
        ))}
      </div>
    </section>
  );
}

function formatDeadline(deadline: bigint) {
  return new Date(Number(deadline) * 1000).toLocaleString();
}

function formatTokenAmount(value: bigint) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fraction}`;
}
