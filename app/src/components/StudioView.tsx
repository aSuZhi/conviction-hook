import type { AppCopy } from '../i18n';
import type { MarketSummary } from '../marketData';
import type { WalletState } from '../wallet';
import type { ActivityItem } from './ActivityFeed';
import { CreateMarketForm } from './CreateMarketForm';
import { ManageMarketForm } from './ManageMarketForm';
import { ResolveMarketForm } from './ResolveMarketForm';

export function StudioView({
  wallet,
  markets,
  selectedMarket,
  onRefresh,
  onActivity,
  copy,
}: {
  wallet: WalletState;
  markets: MarketSummary[];
  selectedMarket: MarketSummary | null;
  onRefresh: () => Promise<void>;
  onActivity?: (item: ActivityItem) => void;
  copy: AppCopy['studio'];
}) {
  return (
    <section className="studio-view">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <span className={wallet.account ? 'studio-status connected' : 'studio-status'}>{wallet.account ? copy.connected : copy.connectRequired}</span>
      </div>
      <div className="studio-grid">
        <div>
          <h3>{copy.create}</h3>
          <CreateMarketForm wallet={wallet} onCreated={onRefresh} />
        </div>
        <div>
          <h3>{copy.manage}</h3>
          <ManageMarketForm
            wallet={wallet}
            markets={markets}
            selectedMarket={selectedMarket}
            onRefresh={onRefresh}
            onActivity={onActivity}
          />
        </div>
        <div>
          <h3>{copy.resolve}</h3>
          <ResolveMarketForm
            wallet={wallet}
            markets={markets}
            selectedMarket={selectedMarket}
            onResolved={onRefresh}
            onActivity={onActivity}
          />
        </div>
      </div>
    </section>
  );
}
