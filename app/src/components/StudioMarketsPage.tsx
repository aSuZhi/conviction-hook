import type { MarketSummary } from '../marketData';
import type { AppRoute } from '../routes';

export function StudioMarketsPage({
  markets,
  onNavigate,
}: {
  markets: MarketSummary[];
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Studio markets</p>
          <h1>Market operations table</h1>
        </div>
        <button className="primary-cta" onClick={() => onNavigate({ kind: 'studioCreate' })}>Create market</button>
      </header>
      <section className="portfolio-panel">
        <table>
          <thead>
            <tr><th>Question</th><th>Market</th><th>Lifecycle</th><th>Deadline</th><th>Pool</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr key={market.address}>
                <td>{market.question}</td>
                <td>{short(market.address)}</td>
                <td>{market.lifecycle}</td>
                <td>{new Date(Number(market.deadline) * 1000).toLocaleString()}</td>
                <td>{market.collateralPool.toString()}</td>
                <td><button className="secondary-cta" onClick={() => onNavigate({ kind: 'studioMarketOperations', marketAddress: market.address })}>Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function short(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
