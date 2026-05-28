import type { AppCopy } from '../i18n';

export type ActivityItem = {
  txHash: `0x${string}`;
  market: `0x${string}`;
  kind: 'create-market' | 'enter' | 'exit' | 'claim' | 'resolve';
  user?: `0x${string}`;
  timestamp?: number;
};

export function ActivityFeed({ items, copy }: { items: ActivityItem[]; copy: AppCopy['activityFeed'] }) {
  return (
    <section className="activity-feed">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      {items.length === 0 ? (
        <p className="muted">{copy.empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.txHash}>
              <strong>{copy.kinds[item.kind]}</strong>
              <span>{shortHash(item.txHash)}</span>
              <small>{item.timestamp ? new Date(item.timestamp).toLocaleString() : copy.pendingTime}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
