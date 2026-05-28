import { formatTokenAmount } from '../dapp';
import type { AppCopy } from '../i18n';
import type { PortfolioPosition } from '../portfolio';

export function ClaimPanel({
  position,
  onClaim,
  copy,
  disabled,
}: {
  position: PortfolioPosition;
  onClaim: (position: PortfolioPosition) => Promise<void>;
  copy: AppCopy['portfolio'];
  disabled?: boolean;
}) {
  if (position.claimable === 0n) return <span className="muted">{copy.noClaim}</span>;

  return (
    <button className="claim-button" onClick={() => void onClaim(position)} disabled={disabled}>
      {copy.claim} {formatTokenAmount(position.claimable, 2)} cUSDC
    </button>
  );
}
