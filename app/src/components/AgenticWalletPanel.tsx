import type { AppCopy } from '../i18n';

type Props = {
  copy: AppCopy['agent'];
};

export function AgenticWalletPanel({ copy }: Props) {
  return (
    <section className="card highlight">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="agent-steps">
        <span>{copy.balance}</span>
        <span>{copy.calldata}</span>
        <span>{copy.signing}</span>
        <span>{copy.events}</span>
      </div>
    </section>
  );
}
