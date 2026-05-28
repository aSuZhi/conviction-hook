import { config } from '../config';
import type { EvidenceItem } from '../evidence';
import type { MarketSummary } from '../marketData';
import { EvidenceCenter } from './EvidenceCenter';

export function ContractProofSection({
  market,
  evidence,
}: {
  market: MarketSummary | null;
  evidence: EvidenceItem[];
}) {
  return (
    <details className="contract-proof-section">
      <summary>
        <span>Contract proof and lifecycle evidence</span>
        <strong>{evidence.length} evidence items</strong>
      </summary>
      <section className="contract-proof-grid">
        <dl>
          <dt>Network</dt>
          <dd>{config.chainName}</dd>
          <dt>DemoJourneyController</dt>
          <dd>{config.demoJourneyController || 'Not configured'}</dd>
          <dt>ConvictionHook</dt>
          <dd>{config.hookAddress || 'Not configured'}</dd>
          <dt>ConvictionRouter</dt>
          <dd>{config.routerAddress || 'Not configured'}</dd>
          <dt>Factory</dt>
          <dd>{config.factoryAddress || 'Not configured'}</dd>
          <dt>Manager</dt>
          <dd>{config.managerAddress || 'Not configured'}</dd>
          <dt>Demo market</dt>
          <dd>{market?.address ?? config.marketAddress ?? 'Not configured'}</dd>
          <dt>YES token</dt>
          <dd>{market?.yesToken ?? config.yesTokenAddress ?? 'Not configured'}</dd>
          <dt>NO token</dt>
          <dd>{market?.noToken ?? config.noTokenAddress ?? 'Not configured'}</dd>
          <dt>Resolver</dt>
          <dd>{config.resolverAddress || 'Not configured'}</dd>
          <dt>PoolKey</dt>
          <dd>
            {config.demoPoolCurrency0 && config.demoPoolCurrency1
              ? `${config.demoPoolCurrency0}/${config.demoPoolCurrency1}/${config.demoPoolFee}/${config.demoPoolTickSpacing}`
              : 'Not configured'}
          </dd>
        </dl>
      </section>
      <EvidenceCenter items={evidence} />
    </details>
  );
}
