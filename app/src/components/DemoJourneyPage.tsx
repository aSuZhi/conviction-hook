import { useEffect, useMemo, useState } from 'react';
import { config } from '../config';
import {
  canUserSettleDemoMarket,
  claimDemoTokens,
  hasDemoJourneyConfig,
  isActiveDemoSessionMarket,
  needsNewDemoSession,
  readDemoJourneyAmounts,
  readNextClaimAt,
  readUserDemoMarket,
  settleDemoMarket,
  startDemoSession,
} from '../demoJourney';
import { formatTokenAmount } from '../dapp';
import type { EvidenceItem } from '../evidence';
import type { AppCopy, Language } from '../i18n';
import type { MarketSummary } from '../marketData';
import { claimMarket, type PortfolioPosition } from '../portfolio';
import type { AppRoute } from '../routes';
import { ensureXLayer, shortAddress, type WalletState } from '../wallet';
import type { ActivityItem } from './ActivityFeed';
import { ContractProofSection } from './ContractProofSection';
import { DemoJourneyStepper, type DemoJourneyStep } from './DemoJourneyStepper';
import { TradingPanel } from './TradingPanel';

type Props = {
  markets: MarketSummary[];
  positions: PortfolioPosition[];
  wallet: WalletState;
  evidence: EvidenceItem[];
  language: Language;
  tradingCopy: AppCopy['trading'];
  onConnect: () => Promise<void>;
  onNavigate: (route: AppRoute) => void;
  onMarketRefresh: () => Promise<void>;
  onEnsureMarket: (address: `0x${string}`) => Promise<MarketSummary>;
  onActivity: (item: ActivityItem) => void;
};

export function DemoJourneyPage({
  markets,
  positions,
  wallet,
  evidence,
  language,
  tradingCopy,
  onConnect,
  onNavigate,
  onMarketRefresh,
  onEnsureMarket,
  onActivity,
}: Props) {
  const zh = language === 'zh';
  const fallbackMarket = useMemo(() => selectDemoMarket(markets), [markets]);
  const [sessionAddress, setSessionAddress] = useState<`0x${string}` | null>(null);
  const [loadedSessionMarket, setLoadedSessionMarket] = useState<MarketSummary | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'loading' | 'missing' | 'ready' | 'error'>('idle');
  const sessionMarket = sessionAddress
    ? markets.find((market) => market.address.toLowerCase() === sessionAddress.toLowerCase()) ??
      (loadedSessionMarket?.address.toLowerCase() === sessionAddress.toLowerCase() ? loadedSessionMarket : null)
    : null;
  const demoMarket = connectedMarket(wallet) ? sessionMarket : fallbackMarket;
  const demoMarketAddress = demoMarket?.address ?? config.marketAddress;
  const demoPosition = demoMarket
    ? positions.find((position) => position.market.address.toLowerCase() === demoMarket.address.toLowerCase())
    : undefined;
  const [nextClaimAt, setNextClaimAt] = useState<bigint>(0n);
  const [claimAmount, setClaimAmount] = useState<bigint>(0n);
  const [poolTokenAmount, setPoolTokenAmount] = useState<bigint>(0n);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const connected = Boolean(wallet.provider && wallet.account);
  const controllerReady = hasDemoJourneyConfig();
  const canClaim = connected && controllerReady && nextClaimAt <= BigInt(Math.floor(Date.now() / 1000));
  const hasPosition = Boolean(demoPosition && (demoPosition.yesAmount > 0n || demoPosition.noAmount > 0n));
  const canSettle = canUserSettleDemoMarket({ connected, controllerReady, market: demoMarket });
  const sessionNeedsStart = connected && controllerReady && sessionStatus !== 'loading' && needsNewDemoSession(sessionMarket);
  const sessionActive = connected && isActiveDemoSessionMarket(sessionMarket);
  const activeSessionHint = zh
    ? '当前钱包已有一个进行中的个人 Demo 市场。先完成买入和结算，或等市场过期后，才能开启下一轮。公开市场创建入口在 Market Studio。'
    : 'This wallet already has an active personal demo market. Trade and settle it, or wait until expiry, before starting another round. Public market creation lives in Market Studio.';
  const canClaimWinnings = Boolean(demoPosition && demoPosition.claimable > 0n && !demoPosition.claimed);
  const yesPercent = demoMarket ? Number(demoMarket.yesProbability) / 1e16 : 50;
  const noPercent = demoMarket ? Number(demoMarket.noProbability) / 1e16 : 50;

  const steps = useMemo<DemoJourneyStep[]>(
    () => [
      {
        id: 'connect',
        label: zh ? '连接钱包' : 'Connect wallet',
        detail: connected && wallet.account ? shortAddress(wallet.account) : zh ? '推荐 OKX 钱包，自动切到 X Layer' : 'OKX Wallet preferred, X Layer selected',
        status: connected ? 'done' : 'active',
      },
      {
        id: 'fund',
        label: zh ? '领取体验资产' : 'Claim demo funds',
        detail: !controllerReady ? (zh ? '等待 Controller 配置' : 'Controller not configured') : canClaim ? (zh ? '现在可领取' : 'Available now') : formatCooldown(nextClaimAt, zh),
        status: !connected || !controllerReady ? 'locked' : canClaim ? 'active' : 'done',
      },
      {
        id: 'session',
        label: zh ? '开启体验市场' : 'Start session',
        detail: !connected
          ? (zh ? '连接钱包后创建个人市场' : 'Connect wallet to create your market')
          : sessionStatus === 'loading'
            ? (zh ? '正在读取个人市场' : 'Reading your session market')
            : sessionActive
              ? shortAddress(sessionMarket!.address)
              : (zh ? '开启新一轮，不影响其他用户' : 'Start a new round without affecting others'),
        status: !connected || !controllerReady ? 'locked' : sessionActive ? 'done' : 'active',
      },
      {
        id: 'trade',
        label: zh ? '买入或卖出' : 'Buy or sell',
        detail: hasPosition ? (zh ? '检测到仓位' : 'Position detected') : zh ? '在右侧交易面板签名' : 'Sign in the trading panel',
        status: !connected || !sessionActive ? 'locked' : hasPosition ? 'done' : 'active',
      },
      {
        id: 'settle',
        label: zh ? '触发结算' : 'Trigger settlement',
        detail: demoMarket?.resolved
          ? (zh ? '市场已结算' : 'Market resolved')
          : canSettle
            ? hasPosition
              ? (zh ? '任选 YES/NO 提交真实 tx' : 'Choose YES or NO and submit tx')
              : (zh ? '无仓位也可结算，用于开启下一轮' : 'No position needed; settle to unlock a new round')
            : (zh ? '等待个人市场就绪' : 'Waiting for session market'),
        status: !sessionActive || !controllerReady ? (demoMarket?.resolved ? 'done' : 'locked') : 'active',
      },
      {
        id: 'claim',
        label: zh ? '领取收益' : 'Claim winnings',
        detail: canClaimWinnings ? `${formatTokenAmount(demoPosition!.claimable, 2)} cUSDC` : zh ? '结算后显示可领取金额' : 'Appears after settlement',
        status: canClaimWinnings ? 'active' : demoPosition?.claimed ? 'done' : 'locked',
      },
    ],
    [
      zh,
      connected,
      wallet.account,
      controllerReady,
      canClaim,
      nextClaimAt,
      sessionStatus,
      sessionActive,
      sessionMarket,
      hasPosition,
      demoMarket,
      canClaimWinnings,
      demoPosition,
    ],
  );

  useEffect(() => {
    void refreshClaimWindow();
  }, [wallet.account, wallet.provider]);

  useEffect(() => {
    void refreshSessionMarket();
  }, [wallet.account, wallet.provider]);

  async function refreshClaimWindow() {
    if (!wallet.provider || !wallet.account || !controllerReady) {
      setNextClaimAt(0n);
      setClaimAmount(0n);
      setPoolTokenAmount(0n);
      return;
    }

    try {
      const [next, amounts] = await Promise.all([
        readNextClaimAt(wallet.provider, wallet.account),
        readDemoJourneyAmounts(wallet.provider),
      ]);
      setNextClaimAt(next);
      setClaimAmount(amounts.claimAmount);
      setPoolTokenAmount(amounts.poolTokenAmount);
    } catch {
      setNextClaimAt(0n);
    }
  }

  async function handleClaimFunds() {
    setError('');
    if (!wallet.provider || !wallet.account) {
      await onConnect();
      return;
    }
    if (!controllerReady) {
      setError(zh ? 'DemoJourneyController 尚未配置。' : 'DemoJourneyController is not configured.');
      return;
    }

    try {
      setBusy('claim');
      await ensureXLayer(wallet.provider);
      const receipt = await claimDemoTokens(wallet.provider, wallet.account);
      setLastTx(receipt.hash);
      onActivity({ txHash: receipt.hash, market: demoMarket?.address ?? config.marketAddress, kind: 'enter', user: wallet.account, timestamp: Date.now() });
      await refreshClaimWindow();
      await onMarketRefresh();
    } catch (caught) {
      setError(resolveDemoError(caught));
    } finally {
      setBusy('');
    }
  }

  async function refreshSessionMarket() {
    if (!wallet.provider || !wallet.account || !controllerReady) {
      setSessionAddress(null);
      setLoadedSessionMarket(null);
      setSessionStatus('idle');
      return;
    }

    try {
      setSessionStatus('loading');
      const address = await readUserDemoMarket(wallet.provider, wallet.account);
      if (isZeroAddress(address)) {
        setSessionAddress(null);
        setLoadedSessionMarket(null);
        setSessionStatus('missing');
        return;
      }

      setSessionAddress(address);
      const market = await onEnsureMarket(address);
      setLoadedSessionMarket(market);
      setSessionStatus('ready');
    } catch {
      setSessionStatus('error');
    }
  }

  async function handleStartSession() {
    setError('');
    if (!wallet.provider || !wallet.account) {
      await onConnect();
      return;
    }
    if (!controllerReady) {
      setError(zh ? 'DemoJourneyController 尚未配置。' : 'DemoJourneyController is not configured.');
      return;
    }

    try {
      setBusy('start-session');
      await ensureXLayer(wallet.provider);
      const receipt = await startDemoSession(wallet.provider, wallet.account);
      const address = await readUserDemoMarket(wallet.provider, wallet.account);
      if (!isZeroAddress(address)) {
        setSessionAddress(address);
        const market = await onEnsureMarket(address);
        setLoadedSessionMarket(market);
        setSessionStatus('ready');
        onActivity({ txHash: receipt.hash, market: address, kind: 'create-market', user: wallet.account, timestamp: Date.now() });
      }
      setLastTx(receipt.hash);
      await onMarketRefresh();
    } catch (caught) {
      setError(resolveDemoError(caught));
    } finally {
      setBusy('');
    }
  }

  async function handleSettle(outcome: 'yes' | 'no') {
    setError('');
    if (!wallet.provider || !wallet.account) {
      await onConnect();
      return;
    }
    if (!demoMarket || !controllerReady) {
      setError(zh ? 'Demo 市场或 Controller 尚未配置。' : 'Demo market or controller is not configured.');
      return;
    }
    if (!canSettle) {
      setError(zh ? '当前 Demo 市场不可结算。' : 'The demo market is not settleable right now.');
      return;
    }

    try {
      setBusy(`settle-${outcome}`);
      await ensureXLayer(wallet.provider);
      const receipt = await settleDemoMarket(wallet.provider, wallet.account, outcome, `demo://settled-${outcome}-${Date.now()}`);
      setLastTx(receipt.hash);
      onActivity({ txHash: receipt.hash, market: demoMarket.address, kind: 'resolve', user: wallet.account, timestamp: Date.now() });
      await onMarketRefresh();
      await refreshSessionMarket();
    } catch (caught) {
      setError(resolveDemoError(caught));
    } finally {
      setBusy('');
    }
  }

  async function handleClaimWinnings() {
    if (!wallet.provider || !wallet.account || !demoPosition) return;
    setError('');

    try {
      setBusy('claim-winnings');
      const txHash = await claimMarket(wallet.provider, demoPosition.market.address, wallet.account);
      setLastTx(txHash);
      onActivity({ txHash, market: demoPosition.market.address, kind: 'claim', user: wallet.account, timestamp: Date.now() });
      await onMarketRefresh();
    } catch (caught) {
      setError(resolveDemoError(caught));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="demo-journey-page">
      <header className="demo-hero">
        <div>
          <p className="eyebrow">{zh ? '裁判与新用户体验' : 'Judge and user onboarding'}</p>
          <h1>{zh ? '用一个钱包走完整链上下注流程' : 'Run the full on-chain betting flow with one wallet'}</h1>
          <p>
            {zh
              ? '连接 OKX 钱包，领取 24 小时一次的体验资产，在预设市场买入或卖出，然后自己触发结算并领取收益。'
              : 'Connect OKX Wallet, claim once-per-24h demo assets, trade the preset market, trigger settlement, and claim winnings.'}
          </p>
        </div>
        <div className="demo-hero-actions">
          <button className="primary-cta" onClick={connected ? handleClaimFunds : onConnect} disabled={busy !== '' || (connected && (!canClaim || !controllerReady))}>
            {!connected
              ? zh ? '连接钱包' : 'Connect wallet'
              : !controllerReady
                ? zh ? '等待 Controller' : 'Controller needed'
                : canClaim ? zh ? '领取测试币' : 'Claim demo funds' : formatCooldown(nextClaimAt, zh)}
          </button>
          <button className="secondary-cta" onClick={connected ? handleStartSession : onConnect} disabled={busy !== '' || (connected && (!controllerReady || (!sessionNeedsStart && sessionStatus !== 'error')))}>
            {busy === 'start-session'
              ? zh ? '创建中' : 'Creating'
              : !connected
                ? zh ? '连接钱包' : 'Connect wallet'
                : sessionNeedsStart || sessionStatus === 'error'
                  ? demoMarket?.resolved || demoMarket?.lifecycle === 'expired' || demoMarket?.voided
                    ? zh ? '开启新一轮体验' : 'Start new round'
                    : zh ? '开启体验市场' : 'Start demo session'
                  : zh ? '已有进行中的体验市场' : 'Active session exists'}
          </button>
          <button className="secondary-cta" onClick={() => onNavigate({ kind: 'marketDetail', marketAddress: demoMarketAddress })}>
            {zh ? '打开市场详情' : 'Open market detail'}
          </button>
          <button className="secondary-cta" onClick={() => onNavigate({ kind: 'studioCreate' })}>
            {zh ? '创建公开市场' : 'Create public market'}
          </button>
          {sessionActive ? <p className="fine-print">{activeSessionHint}</p> : null}
        </div>
      </header>

      <DemoJourneyStepper steps={steps} />

      <section className="demo-workbench">
        <div className="demo-main-stack">
          <section className="demo-market-card">
            <div>
              <p className="eyebrow">{zh ? '我的 Demo 市场' : 'My demo market'}</p>
              <h2>{demoMarket?.question ?? (zh ? '开启个人体验市场' : 'Start your personal demo market')}</h2>
              <p className="muted">
                {connected
                  ? sessionActive
                    ? zh
                      ? '该市场只属于当前钱包，买入、卖出、结算都不会影响其他用户。'
                      : 'This market belongs to the connected wallet. Trading and settlement do not affect other users.'
                    : zh
                      ? '开启一轮新的链上体验市场后即可买入、卖出、结算并领取收益。'
                      : 'Start a fresh on-chain session market, then trade, settle, and claim the result.'
                  : zh
                    ? '连接钱包后会读取或创建属于你的个人体验市场。'
                    : 'Connect a wallet to read or create your personal demo market.'}
              </p>
            </div>
            <dl className="demo-market-metrics">
              <dt>{zh ? '市场状态' : 'Status'}</dt>
              <dd>{demoMarket?.lifecycle ?? (zh ? '等待实时数据' : 'Awaiting live data')}</dd>
              <dt>{zh ? '资金池' : 'Pool'}</dt>
              <dd>{demoMarket ? `${formatTokenAmount(demoMarket.collateralPool, 2)} cUSDC` : '0.00 cUSDC'}</dd>
              <dt>{zh ? 'YES / NO' : 'YES / NO'}</dt>
              <dd>{demoMarket ? `${yesPercent.toFixed(1)}% / ${noPercent.toFixed(1)}%` : '50.0% / 50.0%'}</dd>
              <dt>{zh ? '领取额度' : 'Claim package'}</dt>
              <dd>{claimAmount > 0n ? `${formatTokenAmount(claimAmount, 2)} cUSDC + ${poolTokenAmount.toString()} pool tokens` : controllerReady ? 'Reading' : 'Controller needed'}</dd>
            </dl>
            <div className="demo-settle-actions">
              {sessionNeedsStart || sessionStatus === 'error' ? (
                <button className="primary-cta" onClick={handleStartSession} disabled={busy !== ''}>
                  {busy === 'start-session' ? (zh ? '创建中' : 'Creating') : demoMarket?.resolved ? (zh ? '开启新一轮体验' : 'Start new round') : (zh ? '开启体验市场' : 'Start demo session')}
                </button>
              ) : null}
              <button className="yes-button" onClick={() => handleSettle('yes')} disabled={!canSettle || busy !== ''}>
                {busy === 'settle-yes' ? (zh ? '提交中' : 'Submitting') : 'Settle YES'}
              </button>
              <button className="no-button" onClick={() => handleSettle('no')} disabled={!canSettle || busy !== ''}>
                {busy === 'settle-no' ? (zh ? '提交中' : 'Submitting') : 'Settle NO'}
              </button>
              <button className="primary-cta" onClick={handleClaimWinnings} disabled={!canClaimWinnings || busy !== ''}>
                {zh ? '领取收益' : 'Claim winnings'}
              </button>
            </div>
          </section>

          {error ? <p className="tx-status error">{error}</p> : null}
          {lastTx ? (
            <a className="tx-status" href={`${config.explorerTxUrl}${lastTx}`} target="_blank" rel="noreferrer">
              {zh ? '最新交易：' : 'Latest tx: '}
              {shortHash(lastTx)}
            </a>
          ) : null}
        </div>

        {sessionActive ? (
          <TradingPanel
            market={demoMarket}
            yesProbability={yesPercent}
            noProbability={noPercent}
            wallet={wallet}
            onConnect={onConnect}
            onMarketRefresh={onMarketRefresh}
            onActivity={onActivity}
            initialOutcome="yes"
            copy={tradingCopy}
          />
        ) : (
          <section className="trading-card demo-session-empty">
            <p className="eyebrow">{zh ? '个人体验市场' : 'Personal session'}</p>
            <h2>{connected ? (zh ? '先开启一轮体验' : 'Start a round first') : (zh ? '连接钱包后体验' : 'Connect to begin')}</h2>
            <p className="muted">
              {zh
                ? '每个钱包拥有独立市场。上一位用户结算不会影响你的体验。'
                : 'Each wallet gets an independent market. A previous user settlement cannot block your demo.'}
            </p>
            <button className="primary-cta" onClick={connected ? handleStartSession : onConnect} disabled={busy !== '' || (connected && !controllerReady)}>
              {connected ? (zh ? '开启体验市场' : 'Start demo session') : (zh ? '连接钱包' : 'Connect wallet')}
            </button>
          </section>
        )}
      </section>

      <ContractProofSection market={demoMarket} evidence={evidence} />
    </section>
  );
}

function selectDemoMarket(markets: MarketSummary[]) {
  const configured = markets.find((market) => market.address.toLowerCase() === config.marketAddress.toLowerCase());
  return configured ?? markets.find((market) => market.lifecycle === 'bettable') ?? markets[0] ?? null;
}

function connectedMarket(wallet: WalletState) {
  return Boolean(wallet.provider && wallet.account);
}

function isZeroAddress(address: `0x${string}`) {
  return /^0x0{40}$/i.test(address);
}

function formatCooldown(nextClaimAt: bigint, zh: boolean) {
  const seconds = Number(nextClaimAt - BigInt(Math.floor(Date.now() / 1000)));
  if (seconds <= 0) return zh ? '现在可领取' : 'Available now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return zh ? `${hours} 小时 ${minutes} 分钟后可领` : `${hours}h ${minutes}m until next claim`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function resolveDemoError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) return String((error as { code: unknown }).code);
  if (error instanceof Error) return error.message;
  return String(error);
}
