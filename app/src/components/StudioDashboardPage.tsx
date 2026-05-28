import { config } from '../config';
import type { EvidenceItem } from '../evidence';
import type { MarketSummary } from '../marketData';
import { managerAccess, resolverAccess } from '../operatorAccess';
import type { WalletState } from '../wallet';

export function StudioDashboardPage({
  wallet,
  markets,
  evidence,
}: {
  wallet: WalletState;
  markets: MarketSummary[];
  evidence: EvidenceItem[];
}) {
  const counts = {
    active: markets.filter((market) => market.lifecycle === 'bettable').length,
    paused: markets.filter((market) => market.lifecycle === 'paused').length,
    resolved: markets.filter((market) => market.lifecycle === 'resolved').length,
    voided: markets.filter((market) => market.lifecycle === 'voided').length,
  };
  const manager = managerAccess(wallet.account);
  const resolver = resolverAccess(wallet.account);

  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Market Studio</p>
          <h1>Operator dashboard</h1>
          <p>Separate operator surface for market creation, lifecycle actions, evidence-first resolution, and audit history.</p>
        </div>
      </header>
      <section className="summary-grid">
        <Metric label="Active markets" value={String(counts.active)} />
        <Metric label="Paused" value={String(counts.paused)} />
        <Metric label="Resolved" value={String(counts.resolved)} />
        <Metric label="Voided" value={String(counts.voided)} />
      </section>
      <section className="card">
        <dl>
          <dt>Manager</dt><dd>{config.managerAddress ?? 'Not configured'}</dd>
          <dt>Resolver</dt><dd>{config.resolverAddress ?? 'Not configured'}</dd>
          <dt>Connected wallet</dt><dd>{wallet.account ?? 'Read-only, no wallet connected'}</dd>
          <dt>Manager permission</dt><dd>{manager.reason}</dd>
          <dt>Resolver permission</dt><dd>{resolver.reason}</dd>
          <dt>Recent operator receipts</dt><dd>{evidence.filter((item) => item.kind === 'resolve' || item.kind === 'create-market').length}</dd>
        </dl>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}
