import { useEffect } from 'react';
import type { Language } from '../i18n';
import { shortAddress, type WalletState } from '../wallet';

type Props = {
  open: boolean;
  language: Language;
  wallet: WalletState;
  busy: boolean;
  onClose: () => void;
  onDisconnect: () => void;
  onChangeWallet: () => void;
};

export function WalletAccountModal({ open, language, wallet, busy, onClose, onDisconnect, onChangeWallet }: Props) {
  const zh = language === 'zh';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !wallet.account) return null;

  return (
    <div className="wallet-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wallet-modal wallet-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="wallet-modal-close" type="button" aria-label={zh ? '关闭' : 'Close'} onClick={onClose}>
          x
        </button>
        <div className="wallet-modal-brand">conviction</div>
        <h2 id="wallet-account-title">{zh ? '钱包已连接' : 'Wallet connected'}</h2>
        <p>{zh ? '你可以继续交易，也可以断开当前 DApp 会话。' : 'Continue trading or disconnect this DApp session.'}</p>

        <div className="wallet-account-summary">
          <span className={`wallet-option-icon wallet-option-icon--${wallet.connectorId ?? 'injected'}`} aria-hidden="true" />
          <div>
            <strong>{wallet.walletName ?? (zh ? '浏览器钱包' : 'Browser Wallet')}</strong>
            <small>{wallet.chainId === 196 ? 'X Layer connected' : 'Wrong or unknown network'}</small>
          </div>
        </div>

        <div className="wallet-address-row">
          <span>{zh ? '地址' : 'Address'}</span>
          <strong>{shortAddress(wallet.account)}</strong>
        </div>

        <div className="wallet-modal-actions">
          <button className="secondary-cta" type="button" onClick={onChangeWallet} disabled={busy}>
            {zh ? '切换钱包' : 'Change wallet'}
          </button>
          <button className="danger-cta" type="button" onClick={onDisconnect} disabled={busy}>
            {busy ? (zh ? '断开中' : 'Disconnecting') : zh ? '断开连接' : 'Disconnect'}
          </button>
        </div>
      </section>
    </div>
  );
}
