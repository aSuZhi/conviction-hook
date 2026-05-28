import type { AppCopy } from '../i18n';
import type { MarketStatus } from '../marketData';

type Props = {
  question: string;
  deadline: bigint;
  yesProbability: bigint;
  noProbability: bigint;
  collateralPool: bigint;
  resolved: boolean;
  status: MarketStatus;
  copy: AppCopy['marketDetail'];
};

export function MarketDetail({ question, deadline, yesProbability, noProbability, collateralPool, status, copy }: Props) {
  const yes = Number(yesProbability) / 1e16;
  const no = Number(noProbability) / 1e16;
  const deadlineDate = new Date(Number(deadline) * 1000);

  return (
    <section className="card">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{question}</h2>
      <dl>
        <dt>{copy.yesShare}</dt>
        <dd>{yes.toFixed(2)}%</dd>
        <dt>{copy.noShare}</dt>
        <dd>{no.toFixed(2)}%</dd>
        <dt>{copy.collateralPool}</dt>
        <dd>{formatTokenAmount(collateralPool)} cUSDC</dd>
        <dt>{copy.deadline}</dt>
        <dd>{deadlineDate.toLocaleString()}</dd>
        <dt>{copy.status}</dt>
        <dd>{status === 'resolved' ? copy.resolved : status === 'expired' ? copy.expired : copy.active}</dd>
      </dl>
    </section>
  );
}

function formatTokenAmount(value: bigint) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fraction}`;
}
