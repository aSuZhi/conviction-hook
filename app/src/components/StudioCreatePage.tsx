import type { WalletState } from '../wallet';
import { CreateMarketForm } from './CreateMarketForm';

export function StudioCreatePage({ wallet, onRefresh }: { wallet: WalletState; onRefresh: () => Promise<void> }) {
  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Create</p>
          <h1>Create and register market</h1>
          <p>Wizard shape: market basics, token/outcome parameters, deadline and resolver, review calldata, submit receipt.</p>
        </div>
      </header>
      <section className="studio-view">
        <CreateMarketForm wallet={wallet} onCreated={onRefresh} />
      </section>
    </section>
  );
}
