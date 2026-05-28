import { config } from '../config';
import type { HookPathProof, ProofStep as ProofStepModel } from '../marketProof';

const fallbackSteps: ProofStepModel[] = [
  { label: 'Exact approval', status: 'unavailable' },
  { label: 'ConvictionRouter trade', status: config.routerAddress ? 'configured' : 'unavailable' },
  { label: 'PoolManager.swap', status: 'unavailable' },
  { label: 'ConvictionHook lifecycle check', status: 'unavailable' },
  { label: 'ConvictionMarket accounting', status: 'unavailable' },
];

export function HookPathPanel({ proof }: { proof?: HookPathProof }) {
  const steps = proof ? [proof.exactApproval, proof.router, proof.poolManager, proof.hook, proof.market] : fallbackSteps;
  return (
    <section className="card hook-path-panel">
      <p className="eyebrow">Hook path proof</p>
      <h2>Router to Hook to Market</h2>
      <ol className="proof-steps">
        {steps.map((step) => <ProofStep key={step.label} step={step} />)}
      </ol>
    </section>
  );
}

function ProofStep({ step }: { step: ProofStepModel }) {
  const statusLabel = {
    observed: 'Observed on X Layer',
    configured: 'Configured',
    'not-observed': 'No indexed trade yet',
    unavailable: 'RPC proof unavailable',
  }[step.status];

  return (
    <li>
      <strong>{step.label}</strong>
      {step.txHash ? <a href={`${config.explorerTxUrl}${step.txHash}`} target="_blank" rel="noreferrer">{statusLabel}</a> : <span>{statusLabel}</span>}
    </li>
  );
}
