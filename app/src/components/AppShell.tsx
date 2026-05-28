import type { ReactNode } from 'react';
import type { Language } from '../i18n';
import type { AppRoute } from '../routes';
import { routeToPath } from '../routes';
import { shortAddress, type WalletState } from '../wallet';

type Props = {
  route: AppRoute;
  language: Language;
  search: string;
  wallet: WalletState;
  children: ReactNode;
  onSearchChange: (value: string) => void;
  onNavigate: (route: AppRoute) => void;
  onToggleLanguage: () => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  connectBusy?: boolean;
};

export function AppShell({
  route,
  language,
  search,
  wallet,
  children,
  onSearchChange,
  onNavigate,
  onToggleLanguage,
  onConnect,
  onDisconnect,
  connectBusy = false,
}: Props) {
  const zh = language === 'zh';
  const isActive = (kind: AppRoute['kind']) => route.kind === kind;
  const walletLabel = wallet.account ? shortAddress(wallet.account) : connectBusy ? (zh ? '连接中' : 'Connecting') : zh ? '连接钱包' : 'Connect';

  return (
    <main className="app-shell product-shell">
      <nav className="top-nav production-nav">
        <button className="brand-button" onClick={() => onNavigate({ kind: 'markets' })}>
          Conviction
        </button>
        <button className={isActive('markets') || isActive('marketDetail') ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'markets' })}>
          {zh ? '市场' : 'Markets'}
        </button>
        <button className={isActive('portfolio') ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'portfolio' })}>
          {zh ? '投资组合' : 'Portfolio'}
        </button>
        <button className={isActive('activity') ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'activity' })}>
          {zh ? '活动' : 'Activity'}
        </button>
        <label className="global-search">
          <span>{zh ? '搜索' : 'Search'}</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={zh ? '搜索市场、地址、状态' : 'Search markets, addresses, status'} />
        </label>
        <button className={isActive('demo') || isActive('judge') ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'demo' })}>
          {zh ? '体验' : 'Demo'}
        </button>
        <button className={isActive('agent') ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate({ kind: 'agent' })}>
          Agent
        </button>
        <button className="language-toggle" onClick={onToggleLanguage}>{zh ? 'EN' : '中文'}</button>
        <button className="network-pill" onClick={() => onNavigate({ kind: 'wallet' })}>
          X Layer {wallet.chainId === 196 ? '●' : '○'}
        </button>
        {wallet.account ? (
          <button className="wallet-button connected" onClick={onDisconnect} title={zh ? '管理或断开钱包' : 'Manage or disconnect wallet'}>
            {walletLabel}
          </button>
        ) : (
          <button className="wallet-button" onClick={onConnect} disabled={connectBusy}>{walletLabel}</button>
        )}
      </nav>
      <div className="route-hint">{routeToPath(route)}</div>
      {children}
    </main>
  );
}
