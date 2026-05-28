import type { ActivityItem } from './ActivityFeed';
import type { MarketSummary } from '../marketData';
import type { WalletState } from '../wallet';
import { ManageMarketForm } from './ManageMarketForm';
import { ResolveMarketForm } from './ResolveMarketForm';

export function StudioMarketOperationsPage({
  wallet,
  markets,
  selectedMarket,
  onRefresh,
  onActivity,
}: {
  wallet: WalletState;
  markets: MarketSummary[];
  selectedMarket: MarketSummary | null;
  onRefresh: () => Promise<void>;
  onActivity: (item: ActivityItem) => void;
}) {
  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>{selectedMarket?.question ?? 'Select a market'}</h1>
          <p>High-risk operations are evidence-first: verify wallet permission, target market, operation preview, and receipt.</p>
        </div>
      </header>
      <div className="studio-grid two">
        <section className="studio-view">
          <h2>Pause, unpause, void</h2>
          <ManageMarketForm wallet={wallet} markets={markets} selectedMarket={selectedMarket} onRefresh={onRefresh} onActivity={onActivity} />
        </section>
        <section className="studio-view">
          <h2>Resolve</h2>
          <ResolveMarketForm wallet={wallet} markets={markets} selectedMarket={selectedMarket} onResolved={onRefresh} onActivity={onActivity} />
        </section>
      </div>
    </section>
  );
}
