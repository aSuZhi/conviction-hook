import { config } from '../config';
import type { WalletState } from '../wallet';

export function WalletPage({
  wallet,
  onConnect,
  onDisconnect,
}: {
  wallet: WalletState;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}) {
  return (
    <section className="page-stack">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Wallet and funding</p>
          <h1>Account readiness</h1>
          <p>Check account, network, collateral configuration, and demo funding state before trading.</p>
        </div>
        {!wallet.account ? (
          <button className="primary-cta" onClick={onConnect}>Connect wallet</button>
        ) : (
          <button className="secondary-cta wallet-page-disconnect" onClick={onDisconnect}>Manage wallet</button>
        )}
      </header>
      <section className="card">
        <dl>
          <dt>Connected account</dt><dd>{wallet.account ?? 'Not connected'}</dd>
          <dt>Wallet</dt><dd>{wallet.walletName ?? 'Not connected'}</dd>
          <dt>Network</dt><dd>{wallet.chainId === config.chainId ? config.chainName : 'Wrong or unknown network'}</dd>
          <dt>Collateral token</dt><dd>{config.collateralToken ?? 'Not configured'}</dd>
          <dt>Demo mint</dt><dd>{config.demoPoolBootstrapper ? 'Available in demo mode' : 'Disabled'}</dd>
          <dt>Explorer</dt><dd>OKLink X Layer</dd>
        </dl>
      </section>
    </section>
  );
}
