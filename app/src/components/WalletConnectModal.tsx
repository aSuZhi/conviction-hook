import { useEffect } from 'react';
import type { Language } from '../i18n';
import type { WalletConnector, WalletConnectorId } from '../wallet';

type Props = {
  open: boolean;
  language: Language;
  options: WalletConnector[];
  busy: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (connectorId: WalletConnectorId) => void;
};

export function WalletConnectModal({ open, language, options, busy, onClose, onRefresh, onSelect }: Props) {
  const zh = language === 'zh';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="wallet-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="wallet-modal-close" type="button" aria-label={zh ? '关闭' : 'Close'} onClick={onClose}>
          x
        </button>
        <div className="wallet-modal-brand">conviction</div>
        <h2 id="wallet-modal-title">{zh ? '登录或连接钱包' : 'Log in or connect'}</h2>
        <p>{zh ? '默认优先使用 OKX Wallet，并自动切换到 X Layer。' : 'OKX Wallet is preferred and X Layer is selected automatically.'}</p>

        <div className="wallet-options">
          {options.map((option) => (
            <button
              key={option.id}
              className={option.installed ? 'wallet-option' : 'wallet-option unavailable'}
              type="button"
              disabled={busy || !option.installed}
              onClick={() => onSelect(option.id)}
            >
              <span className={`wallet-option-icon wallet-option-icon--${option.id}`} aria-hidden="true" />
              <span className="wallet-option-copy">
                <strong>{option.name}</strong>
                <small>
                  {option.installed
                    ? zh
                      ? '可用'
                      : 'Available'
                    : zh
                      ? '未检测到'
                      : 'Not detected'}
                </small>
              </span>
              <span className="wallet-option-tags">
                {option.lastUsed && <span>{zh ? '上次使用' : 'Last used'}</span>}
                {option.recommended && <span>{zh ? '推荐' : 'Default'}</span>}
              </span>
            </button>
          ))}
        </div>

        <footer className="wallet-modal-footer">
          <span>X Layer</span>
          <strong>OKB gas</strong>
          <span>{zh ? '自托管签名' : 'Self-custody signing'}</span>
        </footer>
        <button className="wallet-rescan-button" type="button" onClick={onRefresh} disabled={busy}>
          {zh ? '重新检测钱包' : 'Rescan wallets'}
        </button>
      </section>
    </div>
  );
}
