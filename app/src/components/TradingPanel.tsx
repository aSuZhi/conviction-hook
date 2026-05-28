import { useEffect, useState } from 'react';
import { config } from '../config';
import { hasDemoJourneyConfig } from '../demoJourney';
import { type AppCopy } from '../i18n';
import type { MarketSummary } from '../marketData';
import type { ActivityItem } from './ActivityFeed';
import {
  type Balances,
  type Outcome,
  type ReceiptEvidence,
  type TradeMode,
  DappError,
  executeTrade,
  formatTokenAmount,
  hasDappConfig,
  parseTokenAmount,
  prepareDemoBalances,
  readBalances,
} from '../dapp';
import { WalletError, type WalletState, ensureXLayer } from '../wallet';
import { getTradeReadiness } from '../tradeReadiness';
import { MarketReadinessPanel } from './MarketReadinessPanel';

type Props = {
  market: MarketSummary | null;
  yesProbability: number;
  noProbability: number;
  wallet: WalletState;
  onConnect: () => Promise<void>;
  onMarketRefresh: () => Promise<void>;
  onActivity?: (item: ActivityItem) => void;
  initialOutcome?: Outcome;
  copy: AppCopy['trading'];
};

const quickAmounts = ['0.1', '0.5', '1', '2'];

export function TradingPanel({
  market,
  yesProbability,
  noProbability,
  wallet,
  onConnect,
  onMarketRefresh,
  onActivity,
  initialOutcome,
  copy,
}: Props) {
  const [mode, setMode] = useState<TradeMode>('buy');
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome ?? 'yes');
  const [amount, setAmount] = useState('0.1');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptEvidence | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);

  const connected = Boolean(wallet.provider && wallet.account);
  const marketClosed = Boolean(market && market.lifecycle !== 'bettable');
  const busy = !['idle', 'success', 'error'].includes(phase);
  const target = market
    ? { marketAddress: market.address, yesTokenAddress: market.yesToken, noTokenAddress: market.noToken }
    : null;
  const parsedPreviewAmount = safeParseTokenAmount(amount);
  const readiness = getTradeReadiness({
    connected,
    market: market ?? undefined,
    amount: parsedPreviewAmount,
    balances,
    mode,
    outcome,
  });

  useEffect(() => {
    void refreshBalances();
  }, [wallet.account, wallet.provider]);

  useEffect(() => {
    if (initialOutcome) setOutcome(initialOutcome);
  }, [initialOutcome]);

  async function refreshBalances() {
    if (!wallet.provider || !wallet.account || !hasDappConfig(target)) return;
    setBalances(await readBalances(wallet.provider, wallet.account, target));
  }

  async function submitTrade() {
    setError('');
    setReceipt(null);

    try {
      if (!wallet.provider || !wallet.account) {
        await onConnect();
        return;
      }
      await ensureXLayer(wallet.provider);
      if (!target || !hasDappConfig(target)) throw new DappError('MISSING_CONFIG');
      if (marketClosed) throw new DappError('MARKET_CLOSED');

      const parsedAmount = parseTokenAmount(amount);
      const txReceipt = await executeTrade(wallet.provider, wallet.account, target, mode, outcome, parsedAmount, setPhase);
      setPhase('confirming');
      setReceipt(txReceipt);
      onActivity?.({
        txHash: txReceipt.hash,
        market: target.marketAddress,
        kind: mode === 'buy' ? 'enter' : 'exit',
        user: wallet.account,
        timestamp: Date.now(),
      });
      setPhase('success');
      await refreshBalances();
      await onMarketRefresh();
    } catch (caught) {
      setPhase('error');
      setError(resolveError(caught, copy));
    }
  }

  async function prepareDemoTokens() {
    setError('');
    setReceipt(null);

    try {
      if (!wallet.provider || !wallet.account) {
        await onConnect();
        return;
      }
      await ensureXLayer(wallet.provider);
      const parsedAmount = parseTokenAmount(amount || '0.1');
      setPhase('submitting');
      await prepareDemoBalances(wallet.provider, wallet.account, parsedAmount);
      setPhase('success');
      await refreshBalances();
    } catch (caught) {
      setPhase('error');
      setError(resolveError(caught, copy));
    }
  }

  return (
    <aside className="trading-panel">
      <div className="trade-tabs">
        <button className={mode === 'buy' ? 'active' : ''} onClick={() => setMode('buy')} disabled={busy}>{copy.buy}</button>
        <button className={mode === 'sell' ? 'active' : ''} onClick={() => setMode('sell')} disabled={busy}>{copy.sell}</button>
      </div>

      <div className="outcome-tabs" aria-label={copy.outcome}>
        <button className={outcome === 'yes' ? 'yes-button active-choice' : 'yes-button'} onClick={() => setOutcome('yes')} disabled={busy}>YES</button>
        <button className={outcome === 'no' ? 'no-button active-choice' : 'no-button'} onClick={() => setOutcome('no')} disabled={busy}>NO</button>
      </div>

      <div className="selected-outcome">
        <span className="coin-badge">OKB</span>
        <div>
          <strong>{outcome.toUpperCase()}</strong>
          <p>{outcome === 'yes' ? copy.yesPrompt : copy.noPrompt}</p>
        </div>
      </div>

      <label className="amount-input">
        <span>{copy.amount}</span>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={copy.amountPlaceholder} disabled={busy} />
      </label>
      <p className="fine-print">{copy.amountHint}</p>

      <div className="quick-amounts">
        {quickAmounts.map((value) => (
          <button key={value} onClick={() => setAmount(value)} disabled={busy}>{value}</button>
        ))}
      </div>

      <div className="trade-preview">
        <p><span>{copy.yesShare}</span><strong>{yesProbability.toFixed(1)}%</strong></p>
        <p><span>{copy.noShare}</span><strong>{noProbability.toFixed(1)}%</strong></p>
        <p><span>{copy.multiplier}</span><strong>{market?.lifecycle === 'bettable' ? 'Quoted on submit' : 'Unavailable'}</strong></p>
        <p><span>{copy.exitTax}</span><strong>{mode === 'sell' && market?.lifecycle === 'bettable' ? 'Quoted on submit' : 'Unavailable'}</strong></p>
        <p><span>{copy.estimatedClaim}</span><strong className="profit">{previewClaim(mode)}</strong></p>
      </div>

      {balances && (
        <div className="wallet-balances">
          <strong>{copy.balances}</strong>
          <span>{copy.cUsdc}: {formatTokenAmount(balances.collateral)}</span>
          <span>{copy.pool0}: {formatTokenAmount(balances.pool0)}</span>
          <span>{copy.pool1}: {formatTokenAmount(balances.pool1)}</span>
          <span>{copy.yesToken}: {formatTokenAmount(balances.yes)}</span>
          <span>{copy.noToken}: {formatTokenAmount(balances.no)}</span>
        </div>
      )}

      {marketClosed && <p className="tx-status error">This market is {market?.lifecycle}; trading actions are disabled.</p>}
      <MarketReadinessPanel ready={readiness.ready} reasons={readiness.reasons} />
      <button className="primary-cta" onClick={submitTrade} disabled={busy || (connected && !readiness.ready)}>
        {!connected ? copy.connectWallet : marketClosed ? 'Trading closed' : mode === 'buy' ? copy.enter : copy.exit}
      </button>
      <button className="secondary-cta" onClick={prepareDemoTokens} disabled={busy || !connected}>
        {hasDemoJourneyConfig() ? 'Claim demo funds' : 'Demo mint cUSDC + pool tokens'}
      </button>
      <button className="secondary-cta" onClick={refreshBalances} disabled={busy || !connected}>{copy.refreshBalances}</button>

      {phase !== 'idle' && <p className={phase === 'error' ? 'tx-status error' : 'tx-status'}>{phaseLabel(phase, copy)}</p>}
      {error && <p className="tx-status error">{error}</p>}
      {receipt && (
        <div className="receipt-card">
          <strong>{copy.evidence}</strong>
          <a href={`${config.explorerTxUrl}${receipt.hash}`} target="_blank" rel="noreferrer">{receipt.hash}</a>
          <span>{copy.poolSwap}: {receipt.poolSwap ? '✓' : '—'}</span>
          <span>{copy.hookObserved}: {receipt.hookObserved ? '✓' : '—'}</span>
          <span>{copy.marketEvent}: {receipt.marketEvent ? '✓' : '—'}</span>
        </div>
      )}
      <p className="fine-print">{copy.exactApproval}</p>
      <p className="fine-print">{copy.hookPath}</p>
    </aside>
  );
}

function phaseLabel(phase: string, copy: AppCopy['trading']) {
  const labels: Record<string, string> = {
    checking: copy.checking,
    approvingCollateral: copy.approvingCollateral,
    approvingPoolToken: copy.approvingPoolToken,
    submitting: copy.submitting,
    confirming: copy.confirming,
    success: copy.success,
    error: copy.error,
  };
  return labels[phase] || phase;
}

function resolveError(error: unknown, copy: AppCopy['trading']) {
  const code = error instanceof DappError || error instanceof WalletError ? error.code : undefined;
  const providerCode = typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : undefined;
  if (providerCode === 4001) return copy.rejected;

  const messages: Record<string, string> = {
    NO_WALLET: copy.noWallet,
    MISSING_CONFIG: copy.missingConfig,
    INVALID_AMOUNT: copy.invalidAmount,
    INSUFFICIENT_COLLATERAL: copy.insufficientCollateral,
    INSUFFICIENT_POOL_TOKEN: copy.insufficientPoolToken,
    INSUFFICIENT_OUTCOME: copy.insufficientOutcome,
    TX_FAILED: copy.txFailed,
    MARKET_CLOSED: 'Market is not open for trading.',
  };

  return code ? messages[code] || code : error instanceof Error ? error.message : copy.error;
}

function safeParseTokenAmount(value: string) {
  try {
    return parseTokenAmount(value);
  } catch {
    return 0n;
  }
}

function previewClaim(mode: TradeMode) {
  return mode === 'buy' ? 'Settlement-weighted' : 'Returned by tx';
}
