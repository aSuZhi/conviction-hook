import type { ReactNode } from 'react';
import type { AppRoute } from '../routes';
import { shortAddress, type WalletState } from '../wallet';

export function StudioShell({
  children,
  onNavigate,
  wallet,
  onConnect,
  onDisconnect,
}: {
  children: ReactNode;
  onNavigate: (route: AppRoute) => void;
  wallet: WalletState;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}) {
  return (
    <main className="app-shell product-shell studio-app">
      <nav className="studio-topbar">
        <button className="brand-button" onClick={() => onNavigate({ kind: 'studioDashboard' })}>Market Studio</button>
        <span className="operator-badge">Operator console</span>
        <button className="nav-link" onClick={() => onNavigate({ kind: 'markets' })}>Open DApp</button>
        <button className="network-pill">X Layer {wallet.chainId === 196 ? '●' : '○'}</button>
        {wallet.account ? (
          <button className="wallet-button connected" onClick={onDisconnect}>{shortAddress(wallet.account)}</button>
        ) : (
          <button className="wallet-button" onClick={onConnect}>Connect</button>
        )}
      </nav>
      <section className="studio-shell">
        <aside className="studio-sidebar">
          <strong>Market Studio</strong>
          <button onClick={() => onNavigate({ kind: 'studioDashboard' })}>Dashboard</button>
          <button onClick={() => onNavigate({ kind: 'studioMarkets' })}>Markets</button>
          <button onClick={() => onNavigate({ kind: 'studioCreate' })}>Create</button>
          <button onClick={() => onNavigate({ kind: 'demo' })}>Demo Journey</button>
        </aside>
        <div className="studio-content">{children}</div>
      </section>
    </main>
  );
}
