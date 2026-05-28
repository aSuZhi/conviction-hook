import type { ActivityItem } from './ActivityFeed';
import { ActivityFeed } from './ActivityFeed';

const copy = {
  eyebrow: 'Transactions',
  title: 'Receipt history',
  empty: 'Pending, confirmed, and failed transactions will appear after wallet actions.',
  pendingTime: 'Pending time',
  kinds: { 'create-market': 'Create market', enter: 'Enter', exit: 'Exit', claim: 'Claim', resolve: 'Resolve' },
};

export function TransactionActivityPage({ activities }: { activities: ActivityItem[] }) {
  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>Transactions and receipt evidence</h1>
          <p>Local transaction evidence is kept in an indexer-ready shape so the judging proof can be upgraded later.</p>
        </div>
      </header>
      <ActivityFeed items={activities} copy={copy} />
    </section>
  );
}
