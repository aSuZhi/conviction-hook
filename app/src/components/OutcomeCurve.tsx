import type { AppCopy } from '../i18n';
import type { OutcomeCurvePoint } from '../marketEvents';

type Props = {
  yesProbability: number;
  noProbability: number;
  points: OutcomeCurvePoint[];
  loading?: boolean;
  copy: AppCopy['curve'];
};

export function OutcomeCurve({ yesProbability, noProbability, points, loading, copy }: Props) {
  const hasHistory = points.length >= 2;
  const yesLine = toPolyline(points, 'yes');
  const noLine = toPolyline(points, 'no');

  return (
    <section className="curve-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="fine-print">{loading ? 'Indexing X Layer events...' : hasHistory ? 'Indexed from ProbabilityUpdated events' : 'No historical conviction events yet'}</p>
        </div>
        <div className="range-tabs">
          <strong>ALL</strong>
        </div>
      </div>
      <svg viewBox="0 0 760 220" role="img" aria-label="Outcome conviction curve">
        {hasHistory ? (
          <>
            <polyline points={yesLine} fill="none" stroke="#20f4ff" strokeWidth="4" strokeLinecap="round" />
            <polyline points={noLine} fill="none" stroke="#ff4d6d" strokeWidth="4" strokeLinecap="round" />
          </>
        ) : (
          <CurrentProbabilityMarker yesProbability={yesProbability} noProbability={noProbability} />
        )}
      </svg>
      <div className="curve-legend">
        <span><i className="legend-dot yes" /> YES {yesProbability.toFixed(1)}%</span>
        <span><i className="legend-dot no" /> NO {noProbability.toFixed(1)}%</span>
        <span><i className="legend-dot violet" /> {copy.exitTax}</span>
      </div>
    </section>
  );
}

function toPolyline(points: OutcomeCurvePoint[], key: 'yes' | 'no') {
  if (points.length === 0) return '';
  const maxIndex = Math.max(1, points.length - 1);
  return points
    .map((point, index) => {
      const x = (index / maxIndex) * 720 + 20;
      const y = 200 - point[key] * 1.8;
      return `${x.toFixed(1)},${Math.max(16, Math.min(204, y)).toFixed(1)}`;
    })
    .join(' ');
}

function CurrentProbabilityMarker({ yesProbability, noProbability }: { yesProbability: number; noProbability: number }) {
  const yesY = 200 - yesProbability * 1.8;
  const noY = 200 - noProbability * 1.8;
  return (
    <>
      <line x1="60" x2="700" y1={yesY} y2={yesY} stroke="#20f4ff" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      <line x1="60" x2="700" y1={noY} y2={noY} stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      <circle cx="700" cy={yesY} r="6" fill="#20f4ff" />
      <circle cx="700" cy={noY} r="6" fill="#ff4d6d" />
    </>
  );
}
