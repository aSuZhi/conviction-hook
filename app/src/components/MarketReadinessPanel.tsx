import type { ReadinessReason } from '../tradeReadiness';

export function MarketReadinessPanel({ ready, reasons }: { ready: boolean; reasons: ReadinessReason[] }) {
  return (
    <div className={ready ? 'readiness-panel ready' : 'readiness-panel'}>
      <strong>{ready ? 'Ready to route through Hook' : 'Before trading'}</strong>
      <ul>
        {ready ? <li>Wallet, market, amount, and balances are ready.</li> : reasons.map((reason) => <li key={reason.code}>{reason.label}</li>)}
      </ul>
    </div>
  );
}
