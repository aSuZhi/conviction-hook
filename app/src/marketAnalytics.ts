export type MarketLifecycle = 'bettable' | 'expired' | 'resolved' | 'paused' | 'voided';

export type MarketLike = {
  question: string;
  address: `0x${string}`;
  deadline: bigint;
  collateralPool: bigint;
  resolved: boolean;
  paused?: boolean;
  voided?: boolean;
  lifecycle?: MarketLifecycle;
};

export type MarketSortMode = 'hot' | 'endingSoon' | 'pool' | 'newest';

export function getMarketLifecycle(market: MarketLike, nowSeconds = Math.floor(Date.now() / 1000)): MarketLifecycle {
  if (market.voided) return 'voided';
  if (market.paused) return 'paused';
  if (market.resolved) return 'resolved';
  if (market.deadline <= BigInt(nowSeconds)) return 'expired';
  return 'bettable';
}

export function isBettableMarket(market: MarketLike, nowSeconds = Math.floor(Date.now() / 1000)) {
  return getMarketLifecycle(market, nowSeconds) === 'bettable';
}

export function sortMarkets<T extends MarketLike>(markets: T[], mode: MarketSortMode) {
  return [...markets].sort((left, right) => {
    if (mode === 'endingSoon') return compareBigInts(left.deadline, right.deadline);
    if (mode === 'pool' || mode === 'hot') return compareBigInts(right.collateralPool, left.collateralPool);
    return compareBigInts(right.deadline, left.deadline);
  });
}

export function filterMarkets<T extends MarketLike>(
  markets: T[],
  filter: 'bettable' | 'hot' | 'endingSoon' | 'mine' | 'resolved' | 'all',
  query: string,
  ownedMarketAddresses = new Set<string>(),
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const normalizedQuery = query.trim().toLowerCase();
  return markets.filter((market) => {
    const lifecycle = getMarketLifecycle(market, nowSeconds);
    const matchesQuery =
      !normalizedQuery ||
      market.question.toLowerCase().includes(normalizedQuery) ||
      market.address.toLowerCase().includes(normalizedQuery) ||
      lifecycle.includes(normalizedQuery);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'bettable' && lifecycle === 'bettable') ||
      (filter === 'hot' && lifecycle === 'bettable') ||
      (filter === 'endingSoon' && lifecycle === 'bettable') ||
      (filter === 'resolved' && lifecycle === 'resolved') ||
      (filter === 'mine' && ownedMarketAddresses.has(market.address.toLowerCase()));
    return matchesQuery && matchesFilter;
  });
}

export function formatLifecycle(lifecycle: MarketLifecycle) {
  const labels: Record<MarketLifecycle, string> = {
    bettable: 'Bettable',
    expired: 'Expired',
    resolved: 'Resolved',
    paused: 'Paused',
    voided: 'Voided',
  };
  return labels[lifecycle];
}

function compareBigInts(left: bigint, right: bigint) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
