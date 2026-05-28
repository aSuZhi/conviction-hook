import type { MouseEvent } from 'react';
import type { AppCopy } from '../i18n';
import { formatLifecycle, type MarketLifecycle } from '../marketAnalytics';
import type { MarketStatus } from '../marketData';

type Props = {
  title?: string;
  yesProbability?: number;
  noProbability?: number;
  poolSize?: string;
  deadline?: string;
  selected?: boolean;
  status?: MarketStatus;
  lifecycle?: MarketLifecycle;
  onSelect?: () => void;
  onChooseYes?: () => void;
  onChooseNo?: () => void;
  copy: AppCopy['marketCard'];
};

export function MarketCard({
  title,
  yesProbability = 62,
  noProbability = 38,
  poolSize = '$1,240',
  deadline = '10m left',
  selected = false,
  status = 'active',
  lifecycle,
  onSelect,
  onChooseYes,
  onChooseNo,
  copy,
}: Props) {
  return (
    <section className={selected ? 'market-card selected-market' : 'market-card'} onClick={onSelect}>
      <div className="market-card__topline">
        <span className="coin-badge">OKB</span>
        <span className={`status-dot status-${status} status-${lifecycle ?? status}`}>{lifecycle ? formatLifecycle(lifecycle) : statusLabel(status, copy)}</span>
      </div>
      <h2>{title}</h2>
      <div className="split-row">
        <span className="yes-text">{copy.yes} {yesProbability.toFixed(1)}%</span>
        <div className="split-bar" aria-label="YES and NO conviction split">
          <div className="split-bar__yes" style={{ width: `${yesProbability}%` }} />
          <div className="split-bar__no" style={{ width: `${noProbability}%` }} />
        </div>
        <span className="no-text">{copy.no} {noProbability.toFixed(1)}%</span>
      </div>
      <div className="quick-actions">
        <button className="yes-button" type="button" onClick={(event) => handleOutcomeClick(event, onChooseYes)}>{copy.yesPrice}</button>
        <button className="no-button" type="button" onClick={(event) => handleOutcomeClick(event, onChooseNo)}>{copy.noPrice}</button>
      </div>
      <footer>
        <span>{copy.pool} {poolSize}</span>
        <span>{copy.hookActive}</span>
        <span>{deadline}</span>
      </footer>
    </section>
  );
}

function handleOutcomeClick(event: MouseEvent<HTMLButtonElement>, onChoose?: () => void) {
  event.stopPropagation();
  onChoose?.();
}

function statusLabel(status: MarketStatus, copy: AppCopy['marketCard']) {
  if (status === 'resolved') return copy.resolved;
  if (status === 'expired') return copy.expired;
  return copy.live;
}
