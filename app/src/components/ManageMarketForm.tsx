import { useState } from 'react';
import type { MarketSummary } from '../marketData';
import { managerAccess } from '../operatorAccess';
import { earlyResolveMarket, pauseMarket, unpauseMarket, voidMarket } from '../studio';
import { ensureXLayer, type WalletState } from '../wallet';
import type { ActivityItem } from './ActivityFeed';

export function ManageMarketForm({
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
  onActivity?: (item: ActivityItem) => void;
}) {
  const [market, setMarket] = useState(selectedMarket?.address || '');
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [evidenceURI, setEvidenceURI] = useState('');
  const [status, setStatus] = useState('');
  const access = managerAccess(wallet.account);

  async function submit(action: 'pause' | 'unpause' | 'void' | 'earlyResolve') {
    if (!wallet.provider || !market || !access.allowed) return;
    await ensureXLayer(wallet.provider);
    setStatus(`${action}...`);
    const marketAddress = market as `0x${string}`;
    const receipt =
      action === 'pause'
        ? await pauseMarket(wallet.provider, marketAddress)
        : action === 'unpause'
          ? await unpauseMarket(wallet.provider, marketAddress)
          : action === 'void'
            ? await voidMarket(wallet.provider, marketAddress, evidenceURI)
            : await earlyResolveMarket(wallet.provider, marketAddress, outcome, evidenceURI);
    setStatus(`${action} submitted: ${receipt.hash}`);
    if (action === 'earlyResolve') {
      onActivity?.({ txHash: receipt.hash, market: marketAddress, kind: 'resolve', user: wallet.account ?? undefined, timestamp: Date.now() });
    }
    await onRefresh();
  }

  return (
    <form className="studio-form" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>Market</span>
        <select value={market} onChange={(event) => setMarket(event.target.value)}>
          <option value="">Select market</option>
          {markets.map((item) => <option key={item.address} value={item.address}>{item.question}</option>)}
        </select>
      </label>
      <div className="outcome-tabs">
        <button type="button" className={outcome === 'yes' ? 'yes-button active-choice' : 'yes-button'} onClick={() => setOutcome('yes')}>YES</button>
        <button type="button" className={outcome === 'no' ? 'no-button active-choice' : 'no-button'} onClick={() => setOutcome('no')}>NO</button>
      </div>
      <label><span>Evidence URI</span><input value={evidenceURI} onChange={(event) => setEvidenceURI(event.target.value)} placeholder="ipfs:// or https://" /></label>
      <p className={access.allowed ? 'muted' : 'tx-status error'}>{access.reason}</p>
      <div className="studio-actions">
        <button type="button" className="secondary-cta" onClick={() => void submit('pause')} disabled={!wallet.provider || !market || !access.allowed}>Pause</button>
        <button type="button" className="secondary-cta" onClick={() => void submit('unpause')} disabled={!wallet.provider || !market || !access.allowed}>Unpause</button>
        <button type="button" className="secondary-cta danger" onClick={() => void submit('void')} disabled={!wallet.provider || !market || !access.allowed}>Void</button>
        <button type="button" className="primary-cta" onClick={() => void submit('earlyResolve')} disabled={!wallet.provider || !market || !access.allowed}>Early resolve</button>
      </div>
      {status && <p className="tx-status">{status}</p>}
    </form>
  );
}
