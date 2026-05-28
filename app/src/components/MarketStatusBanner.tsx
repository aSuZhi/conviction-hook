import type { MarketSummary } from '../marketData';

export function MarketStatusBanner({ market }: { market: MarketSummary }) {
  if (market.lifecycle === 'bettable') return null;
  const copy = {
    expired: 'Market expired. New entry is disabled while settlement waits for resolver action.',
    resolved: 'Market resolved. Trading is closed and eligible winners can claim.',
    paused: 'Market paused by the protocol operator. Trading actions are disabled.',
    voided: 'Market voided. Trading is closed and refund/void handling applies.',
  } as const;

  return <section className={`status-banner ${market.lifecycle}`}>{copy[market.lifecycle]}</section>;
}
