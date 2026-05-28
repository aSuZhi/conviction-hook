import { convictionShare, formatMultiplier, type ConvictionMechanismSnapshot } from '../convictionAnalytics';
import { formatTokenAmount } from '../dapp';

export function ConvictionEnginePanel({ snapshot }: { snapshot: ConvictionMechanismSnapshot }) {
  const share = convictionShare(snapshot.yesConvictionWeight, snapshot.noConvictionWeight);

  return (
    <section className="card mechanism-panel">
      <p className="eyebrow">Conviction Engine</p>
      <h2>Right, early, committed</h2>
      <p className="muted">Conviction rewards users who are right, early, and committed. Weight is account-specific protocol accounting, not simply a transferable token balance.</p>
      <div className="mechanism-grid">
        <Metric label="YES conviction" value={snapshot.yesConvictionWeight !== undefined ? formatTokenAmount(snapshot.yesConvictionWeight, 2) : 'Not indexed yet'} />
        <Metric label="NO conviction" value={snapshot.noConvictionWeight !== undefined ? formatTokenAmount(snapshot.noConvictionWeight, 2) : 'Not indexed yet'} />
        <Metric label="Connected account" value={snapshot.userConvictionWeight !== undefined ? formatTokenAmount(snapshot.userConvictionWeight, 2) : 'Connect wallet to inspect'} />
        <Metric label="Early entry" value={formatMultiplier(snapshot.earlyEntryMultiplier)} />
        <Metric label="Holding time" value={formatMultiplier(snapshot.holdingTimeMultiplier)} />
        <Metric label="Contrarian" value={formatMultiplier(snapshot.contrarianMultiplier)} />
        <Metric label="Share label" value={share.known ? `${share.yes.toFixed(1)}% / ${share.no.toFixed(1)}%` : 'Market-implied conviction share'} />
      </div>
      {!snapshot.analyticsKnown ? <p className="fine-print">No mechanism reads were available from the current RPC response. This panel does not invent conviction values.</p> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
