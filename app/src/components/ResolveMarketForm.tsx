import { useState } from 'react';
import { config } from '../config';
import type { MarketSummary } from '../marketData';
import { resolverAccess } from '../operatorAccess';
import { readMarketId, resolveMarket, setOutcome } from '../studio';
import { ensureXLayer, type WalletState } from '../wallet';
import type { ActivityItem } from './ActivityFeed';

export function ResolveMarketForm({
  wallet,
  markets,
  selectedMarket,
  onResolved,
  onActivity,
}: {
  wallet: WalletState;
  markets: MarketSummary[];
  selectedMarket: MarketSummary | null;
  onResolved: () => Promise<void>;
  onActivity?: (item: ActivityItem) => void;
}) {
  const [market, setMarket] = useState<string>(selectedMarket?.address || '');
  const [resolver, setResolver] = useState<string>(config.resolverAddress || '');
  const [outcome, setOutcomeValue] = useState<'yes' | 'no'>('yes');
  const [evidenceUri, setEvidenceUri] = useState('');
  const [status, setStatus] = useState('');
  const access = resolverAccess(wallet.account);

  async function submit() {
    if (!wallet.provider || !market || !access.allowed) return;
    await ensureXLayer(wallet.provider);
    setStatus('Reading market id...');
    const marketId = await readMarketId(wallet.provider, market as `0x${string}`);
    setStatus(`Setting ${outcome.toUpperCase()} outcome...`);
    await setOutcome(wallet.provider, resolver as `0x${string}`, marketId, outcome);
    setStatus('Resolving market...');
    const receipt = await resolveMarket(wallet.provider, market as `0x${string}`);
    onActivity?.({
      txHash: receipt.hash,
      market: market as `0x${string}`,
      kind: 'resolve',
      user: wallet.account ?? undefined,
      timestamp: Date.now(),
    });
    setStatus(evidenceUri ? `Resolved with evidence note: ${evidenceUri}` : 'Resolved market');
    await onResolved();
  }

  return (
    <form className="studio-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label>
        <span>Market</span>
        <select value={market} onChange={(event) => setMarket(event.target.value)}>
          <option value="">Select market</option>
          {markets.map((item) => <option key={item.address} value={item.address}>{item.question}</option>)}
        </select>
      </label>
      <label><span>Resolver</span><input value={resolver} onChange={(event) => setResolver(event.target.value)} /></label>
      <div className="outcome-tabs">
        <button type="button" className={outcome === 'yes' ? 'yes-button active-choice' : 'yes-button'} onClick={() => setOutcomeValue('yes')}>YES</button>
        <button type="button" className={outcome === 'no' ? 'no-button active-choice' : 'no-button'} onClick={() => setOutcomeValue('no')}>NO</button>
      </div>
      <label><span>Evidence URI</span><input value={evidenceUri} onChange={(event) => setEvidenceUri(event.target.value)} placeholder="ipfs:// or https://" /></label>
      <p className={access.allowed ? 'muted' : 'tx-status error'}>{access.reason}</p>
      <button className="primary-cta" type="submit" disabled={!wallet.provider || !market || !access.allowed}>Set outcome and resolve</button>
      {status && <p className="tx-status">{status}</p>}
    </form>
  );
}
