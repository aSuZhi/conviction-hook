import { useState } from 'react';
import { estimateClaim, type ConvictionMechanismSnapshot } from '../convictionAnalytics';
import type { EvidenceItem } from '../evidence';
import type { MarketHistoryEvent } from '../marketEvents';
import type { MarketSummary } from '../marketData';
import type { HookPathProof, ProofStep } from '../marketProof';
import type { PortfolioPosition } from '../portfolio';
import { ActivityFeed, type ActivityItem } from './ActivityFeed';
import { config } from '../config';
import { formatTokenAmount } from '../dapp';

export function MarketInfoTabs({
  market,
  position,
  activities,
  evidence,
  snapshot,
  proof,
  history,
}: {
  market: MarketSummary;
  position?: PortfolioPosition;
  activities: ActivityItem[];
  evidence: EvidenceItem[];
  snapshot: ConvictionMechanismSnapshot;
  proof?: HookPathProof;
  history: MarketHistoryEvent[];
}) {
  const [tab, setTab] = useState<'overview' | 'flow' | 'position' | 'events' | 'settlement'>('overview');
  const marketActivities = activities.filter((item) => item.market.toLowerCase() === market.address.toLowerCase());
  const eventCounts = summarizeEvents(history);
  const proofSteps = proof ? [proof.exactApproval, proof.router, proof.poolManager, proof.hook, proof.market] : fallbackProofSteps();
  const observedSteps = proofSteps.filter((step) => step.status === 'observed').length;
  const userWeight = position ? position.yesWeight + position.noWeight : 0n;
  const winningWeight =
    market.resolved && snapshot.yesConvictionWeight !== undefined && snapshot.noConvictionWeight !== undefined
      ? market.yesProbability >= market.noProbability
        ? snapshot.yesConvictionWeight
        : snapshot.noConvictionWeight
      : userWeight;
  const estimatedClaim = estimateClaim(market.collateralPool, userWeight, winningWeight);

  return (
    <section className="market-data-console">
      <div className="data-console-header">
        <div>
          <p className="eyebrow">Market data console</p>
          <h2>Execution, conviction, settlement</h2>
          <p>Live reads, indexed events, and wallet-specific accounting are separated so the market is inspectable before a user trades.</p>
        </div>
        <div className="data-console-health">
          <strong>{eventCounts.total > 0 ? 'Indexed market' : 'Awaiting first indexed trade'}</strong>
          <span>{observedSteps}/5 route checks observed</span>
        </div>
      </div>

      <div className="data-summary-grid">
        <SummaryMetric label="Collateral pool" value={`${formatTokenAmount(market.collateralPool, 2)} cUSDC`} detail={market.lifecycle} />
        <SummaryMetric label="YES exposure" value={formatMaybeToken(snapshot.yesConvictionWeight)} detail="conviction weight" />
        <SummaryMetric label="NO exposure" value={formatMaybeToken(snapshot.noConvictionWeight)} detail="conviction weight" />
        <SummaryMetric label="Indexed events" value={String(eventCounts.total)} detail={`${eventCounts.entries} entries, ${eventCounts.exits} exits`} />
        <SummaryMetric label="My weight" value={formatTokenAmount(userWeight, 2)} detail={position ? 'connected wallet' : 'connect wallet'} />
        <SummaryMetric label="Estimated claim" value={`${formatTokenAmount(estimatedClaim, 2)} cUSDC`} detail={market.resolved ? 'claim path' : 'pre-resolution'} />
      </div>

      <div className="portfolio-tabs data-tabs">
        {(['overview', 'flow', 'position', 'events', 'settlement'] as const).map((value) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}</button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewPanel market={market} snapshot={snapshot} history={history} proofSteps={proofSteps} /> : null}
      {tab === 'flow' ? <FlowPanel steps={proofSteps} /> : null}
      {tab === 'position' ? <PositionPanel position={position} market={market} /> : null}
      {tab === 'events' ? <EventsPanel activities={marketActivities} history={history} /> : null}
      {tab === 'settlement' ? <SettlementPanel market={market} position={position} snapshot={snapshot} /> : null}
    </section>
  );
}

function OverviewPanel({
  market,
  snapshot,
  history,
  proofSteps,
}: {
  market: MarketSummary;
  snapshot: ConvictionMechanismSnapshot;
  history: MarketHistoryEvent[];
  proofSteps: ProofStep[];
}) {
  const yesWeight = snapshot.yesConvictionWeight ?? 0n;
  const noWeight = snapshot.noConvictionWeight ?? 0n;
  const totalWeight = yesWeight + noWeight;
  const yesShare = totalWeight === 0n ? Number(market.yesProbability) / 1e16 : Number((yesWeight * 10000n) / totalWeight) / 100;
  const noShare = Math.max(0, 100 - yesShare);
  const latestEvent = history.length > 0 ? history[history.length - 1] : undefined;

  return (
    <section className="data-panel-grid">
      <div className="data-panel primary">
        <p className="eyebrow">Conviction distribution</p>
        <h3>{yesShare.toFixed(1)}% YES</h3>
        <div className="conviction-stack" aria-label="Conviction distribution">
          <span className="yes" style={{ width: `${Math.max(2, yesShare)}%` }} />
          <span className="no" style={{ width: `${Math.max(2, noShare)}%` }} />
        </div>
        <div className="split-row dense">
          <span>YES {formatTokenAmount(yesWeight, 2)}</span>
          <span>NO {formatTokenAmount(noWeight, 2)}</span>
        </div>
      </div>
      <div className="data-panel">
        <p className="eyebrow">Latest chain signal</p>
        <h3>{latestEvent ? eventLabel(latestEvent) : 'No event indexed'}</h3>
        <p className="muted">{latestEvent ? `Block ${latestEvent.blockNumber.toString()}` : 'The panel is live, but no market event is available from the current RPC window.'}</p>
      </div>
      <div className="data-panel">
        <p className="eyebrow">Route readiness</p>
        <h3>{proofSteps.filter((step) => step.status === 'observed').length}/5 observed</h3>
        <p className="muted">Configured router is separated from observed execution so judge-facing proof does not pretend a trade occurred.</p>
      </div>
    </section>
  );
}

function FlowPanel({ steps }: { steps: ProofStep[] }) {
  return (
    <section className="route-proof-console">
      <p className="eyebrow">Hook route proof</p>
      <h3>Execution path</h3>
      <ol className="route-proof-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={step.status}>
            <span className="step-index">{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{proofStatusCopy(step)}</small>
            </div>
            {step.txHash ? <a href={`${config.explorerTxUrl}${step.txHash}`} target="_blank" rel="noreferrer">Receipt</a> : <span className="proof-state">{proofStatusLabel(step.status)}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PositionPanel({ position, market }: { position?: PortfolioPosition; market: MarketSummary }) {
  if (!position) {
    return (
      <section className="empty-data-state">
        <strong>No connected-wallet position</strong>
        <p>Connect a wallet or open a filled market position to see side, weight, cost basis, claimability, and exit readiness here.</p>
      </section>
    );
  }

  return (
    <section className="data-panel-grid">
      <SummaryMetric label="YES shares" value={formatTokenAmount(position.yesAmount, 2)} detail={`${(Number(market.yesProbability) / 1e16).toFixed(1)}% market`} />
      <SummaryMetric label="NO shares" value={formatTokenAmount(position.noAmount, 2)} detail={`${(Number(market.noProbability) / 1e16).toFixed(1)}% market`} />
      <SummaryMetric label="Conviction weight" value={formatTokenAmount(position.yesWeight + position.noWeight, 2)} detail="settlement weight" />
      <SummaryMetric label="Claimable" value={formatTokenAmount(position.claimable, 2)} detail={position.claimed ? 'claimed' : 'open'} />
    </section>
  );
}

function EventsPanel({ activities, history }: { activities: ActivityItem[]; history: MarketHistoryEvent[] }) {
  return (
    <section className="market-events-panel data-panel">
      <p className="eyebrow">Indexed events</p>
      {history.length === 0 ? <p className="muted">No indexed market events from the current RPC window. This is an honest empty state, not placeholder data.</p> : null}
      {history.length > 0 ? (
        <ol className="event-log-list">
          {history.slice(-8).map((event) => (
            <li key={`${event.txHash}-${event.logIndex.toString()}`}>
              <strong>{eventLabel(event)}</strong>
              <span>block {event.blockNumber.toString()}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <ActivityFeed items={activities} copy={activityCopy} />
    </section>
  );
}

function SettlementPanel({
  market,
  position,
  snapshot,
}: {
  market: MarketSummary;
  position?: PortfolioPosition;
  snapshot: ConvictionMechanismSnapshot;
}) {
  const userWeight = position ? position.yesWeight + position.noWeight : 0n;
  const totalWinningWeight = market.resolved
    ? market.yesProbability >= market.noProbability
      ? snapshot.yesConvictionWeight ?? 0n
      : snapshot.noConvictionWeight ?? 0n
    : 0n;
  const estimatedClaim = estimateClaim(market.collateralPool, userWeight, totalWinningWeight || userWeight);

  return (
    <section className="settlement-console">
      <div className="data-panel primary">
        <p className="eyebrow">Settlement math</p>
        <h3>{market.resolved ? 'Ready for claims' : 'Waiting for resolver'}</h3>
        <p className="muted">Claims are weighted by winning-side conviction, not just token count. Until resolution, this remains a preview.</p>
      </div>
      <dl className="settlement-ledger">
        <dt>Distributable collateral</dt><dd>{formatTokenAmount(market.collateralPool, 2)} cUSDC</dd>
        <dt>Winning outcome</dt><dd>{market.resolved ? 'Resolved' : 'Awaiting resolver'}</dd>
        <dt>User weight</dt><dd>{formatTokenAmount(userWeight, 2)}</dd>
        <dt>Total winning weight</dt><dd>{totalWinningWeight > 0n ? formatTokenAmount(totalWinningWeight, 2) : 'Unknown until resolution'}</dd>
        <dt>Formula</dt><dd>userWeight / totalWinningWeight * collateral</dd>
        <dt>Estimated claim</dt><dd>{formatTokenAmount(estimatedClaim, 2)} cUSDC</dd>
      </dl>
    </section>
  );
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="data-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function formatMaybeToken(value?: bigint) {
  return value === undefined ? 'Awaiting RPC' : formatTokenAmount(value, 2);
}

function summarizeEvents(history: MarketHistoryEvent[]) {
  return {
    total: history.length,
    entries: history.filter((event) => event.kind === 'enter').length,
    exits: history.filter((event) => event.kind === 'exit').length,
  };
}

function fallbackProofSteps(): ProofStep[] {
  return [
    { label: 'Exact approval', status: 'not-observed' },
    { label: 'ConvictionRouter trade', status: config.routerAddress ? 'configured' : 'unavailable' },
    { label: 'PoolManager.swap', status: 'not-observed' },
    { label: 'ConvictionHook lifecycle check', status: 'not-observed' },
    { label: 'ConvictionMarket accounting', status: 'not-observed' },
  ];
}

function proofStatusLabel(status: ProofStep['status']) {
  return {
    observed: 'Observed',
    configured: 'Configured',
    'not-observed': 'Waiting',
    unavailable: 'Unavailable',
  }[status];
}

function proofStatusCopy(step: ProofStep) {
  if (step.status === 'observed') return 'Receipt indexed from X Layer logs';
  if (step.status === 'configured') return 'Contract address is configured';
  if (step.status === 'not-observed') return 'Waiting for a live trade receipt';
  return 'RPC proof unavailable';
}

function eventLabel(event: MarketHistoryEvent) {
  switch (event.kind) {
    case 'probability':
      return 'Probability updated';
    case 'enter':
      return `Entered ${event.outcome.toUpperCase()}`;
    case 'exit':
      return `Exited ${event.outcome.toUpperCase()}`;
    case 'resolved':
      return `Resolved ${event.winningOutcome.toUpperCase()}`;
  }
}

const activityCopy = {
  eyebrow: 'Hook events',
  title: 'Market activity',
  empty: 'No local receipts for this market yet.',
  pendingTime: 'Pending time',
  kinds: { 'create-market': 'Create market', enter: 'Enter', exit: 'Exit', claim: 'Claim', resolve: 'Resolve' },
};
