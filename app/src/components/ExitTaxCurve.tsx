import { formatBps, type ConvictionMechanismSnapshot } from '../convictionAnalytics';

export function ExitTaxCurve({ snapshot, deadline }: { snapshot: ConvictionMechanismSnapshot; deadline: bigint }) {
  const secondsLeft = Number(deadline - BigInt(Math.floor(Date.now() / 1000)));
  const clampedProgress = Math.max(0, Math.min(100, 100 - secondsLeft / 36));

  return (
    <section className="card exit-tax-panel">
      <p className="eyebrow">Exit tax</p>
      <h2>{snapshot.currentExitTaxBps !== undefined ? formatBps(snapshot.currentExitTaxBps) : 'Awaiting live tax quote'}</h2>
      <p className="muted">
        {snapshot.currentExitTaxBps !== undefined
          ? 'Exit tax is derived from current market timing and side pressure.'
          : 'The submitted contracts expose exit tax through trade execution, so the UI shows a quote only when a reliable preview is available.'}
      </p>
      <div className="tax-line">
        <span style={{ width: `${clampedProgress}%` }} />
      </div>
      <dl>
        <dt>Base tax</dt><dd>{formatBps(snapshot.baseExitTaxBps)}</dd>
        <dt>Time tax</dt><dd>{formatBps(snapshot.timeExitTaxBps)}</dd>
        <dt>Imbalance tax</dt><dd>{formatBps(snapshot.imbalanceExitTaxBps)}</dd>
      </dl>
    </section>
  );
}
