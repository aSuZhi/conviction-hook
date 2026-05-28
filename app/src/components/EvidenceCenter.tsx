import { config } from '../config';
import { evidenceStatus, type EvidenceItem } from '../evidence';

export function EvidenceCenter({ items }: { items: EvidenceItem[] }) {
  return (
    <section className="portfolio-panel evidence-center">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Evidence Center</p>
          <h2>Judging proof</h2>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Source</th>
            <th>Market</th>
            <th>Transaction</th>
            <th>PoolManager</th>
            <th>Hook</th>
            <th>Market event</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={8}>No evidence imported yet.</td></tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>{item.source}</td>
                <td>{item.market ? short(item.market) : 'n/a'}</td>
                <td>{item.txHash ? <a href={`${config.explorerTxUrl}${item.txHash}`} target="_blank" rel="noreferrer">{short(item.txHash)}</a> : 'not observed yet'}</td>
                <td>{mark(item.poolManagerObserved)}</td>
                <td>{mark(item.hookObserved)}</td>
                <td>{mark(item.marketEventObserved)}</td>
                <td>{evidenceStatus(item)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function mark(value?: boolean) {
  return value ? 'observed' : 'not observed yet';
}

function short(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
