import { formatTokenAmount } from '../dapp';
import type { PortfolioPosition } from '../portfolio';
import { estimatePositionValue, hasVisiblePosition } from '../portfolioAnalytics';

export function PortfolioPositionsTable({
  positions,
  onClaim,
  busy,
}: {
  positions: PortfolioPosition[];
  onClaim: (position: PortfolioPosition) => Promise<void>;
  busy?: boolean;
}) {
  const visible = positions.filter(hasVisiblePosition);

  return (
    <section className="portfolio-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Positions</p>
          <h2>Market exposure</h2>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Market</th>
            <th>YES</th>
            <th>NO</th>
            <th>Current value</th>
            <th>Cost basis</th>
            <th>PnL</th>
            <th>Claimable</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr><td colSpan={8}>No positions yet. Browse bettable markets to start.</td></tr>
          ) : (
            visible.map((position) => (
              <tr key={position.market.address}>
                <td>{position.market.question}</td>
                <td>{formatTokenAmount(position.yesAmount, 2)}</td>
                <td>{formatTokenAmount(position.noAmount, 2)}</td>
                <td>{formatTokenAmount(estimatePositionValue(position), 2)}</td>
                <td>Unavailable</td>
                <td>Awaiting trade history</td>
                <td>{formatTokenAmount(position.claimable, 2)}</td>
                <td>
                  <button className="claim-button" disabled={busy || position.claimable === 0n || position.claimed} onClick={() => onClaim(position)}>
                    Claim
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
