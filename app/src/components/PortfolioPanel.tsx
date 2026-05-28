import type { AppCopy } from '../i18n';
import { formatTokenAmount } from '../dapp';
import type { PortfolioPosition } from '../portfolio';
import { ClaimPanel } from './ClaimPanel';

type Props = {
  copy: AppCopy['portfolio'];
  positions: PortfolioPosition[];
  onClaim: (position: PortfolioPosition) => Promise<void>;
  busy?: boolean;
};

export function PortfolioPanel({ copy, positions, onClaim, busy }: Props) {
  const visiblePositions = positions.filter(
    (position) => position.yesAmount > 0n || position.noAmount > 0n || position.claimable > 0n,
  );
  const totalClaimable = positions.reduce((sum, position) => sum + position.claimable, 0n);

  return (
    <section className="portfolio-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <div className="pnl-card">{copy.claimable} <strong>{formatTokenAmount(totalClaimable, 2)} cUSDC</strong></div>
      </div>
      <div className="portfolio-tabs"><strong>{copy.positions}</strong><span>{copy.exits}</span><span>{copy.activity}</span><span>{copy.claims}</span></div>
      <table>
        <thead>
          <tr><th>{copy.market}</th><th>{copy.outcome}</th><th>{copy.shares}</th><th>{copy.multiplier}</th><th>{copy.claimable}</th></tr>
        </thead>
        <tbody>
          {visiblePositions.length === 0 ? (
            <tr><td colSpan={5}>{copy.empty}</td></tr>
          ) : (
            visiblePositions.flatMap((position) => [
              <tr key={`${position.market.address}-yes`}>
                <td>{position.market.question}</td>
                <td>YES</td>
                <td>{formatTokenAmount(position.yesAmount)}</td>
                <td>{formatMultiplier(position.yesAmount, position.yesWeight)}</td>
                <td rowSpan={position.noAmount > 0n ? 2 : 1}>
                  <ClaimPanel position={position} onClaim={onClaim} copy={copy} disabled={busy} />
                </td>
              </tr>,
              position.noAmount > 0n ? (
                <tr key={`${position.market.address}-no`}>
                  <td>{position.market.question}</td>
                  <td>NO</td>
                  <td>{formatTokenAmount(position.noAmount)}</td>
                  <td>{formatMultiplier(position.noAmount, position.noWeight)}</td>
                </tr>
              ) : null,
            ])
          )}
        </tbody>
      </table>
    </section>
  );
}

function formatMultiplier(amount: bigint, weight: bigint) {
  if (amount === 0n) return '0.00x';
  const scaled = (weight * 100n) / amount;
  const whole = scaled / 100n;
  const fraction = (scaled % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}x`;
}
