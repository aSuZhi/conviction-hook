import type { MarketSortMode } from '../marketAnalytics';

export type MarketFilter = 'bettable' | 'hot' | 'endingSoon' | 'mine' | 'resolved' | 'all';

export function MarketFilterBar({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: {
  filter: MarketFilter;
  sort: MarketSortMode;
  onFilterChange: (filter: MarketFilter) => void;
  onSortChange: (sort: MarketSortMode) => void;
}) {
  const filters: Array<[MarketFilter, string]> = [
    ['bettable', 'Bettable'],
    ['hot', 'Hot'],
    ['endingSoon', 'Ending soon'],
    ['mine', 'My positions'],
    ['resolved', 'Resolved'],
    ['all', 'All'],
  ];

  return (
    <div className="market-filter-bar">
      <div className="filter-tabs">
        {filters.map(([value, label]) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => onFilterChange(value)}>
            {label}
          </button>
        ))}
      </div>
      <select value={sort} onChange={(event) => onSortChange(event.target.value as MarketSortMode)}>
        <option value="hot">Hot</option>
        <option value="endingSoon">Ending soon</option>
        <option value="pool">Pool size</option>
        <option value="newest">Newest</option>
      </select>
    </div>
  );
}
