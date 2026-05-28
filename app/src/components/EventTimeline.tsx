import type { AppCopy } from '../i18n';

type Props = {
  copy: AppCopy['timeline'];
};

export function EventTimeline({ copy }: Props) {
  return (
    <section className="card">
      <p className="eyebrow">{copy.eyebrow}</p>
      <ol className="timeline">
        <li><strong>HookSwapObserved</strong><span>{copy.hookSwap}</span></li>
        <li><strong>ConvictionEntered</strong><span>{copy.entered}</span></li>
        <li><strong>ProbabilityUpdated</strong><span>{copy.probability}</span></li>
        <li><strong>ConvictionExited</strong><span>{copy.exited}</span></li>
        <li><strong>Claimed</strong><span>{copy.claimed}</span></li>
      </ol>
    </section>
  );
}
