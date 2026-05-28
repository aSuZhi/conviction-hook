import { useCallback, useEffect, useState } from 'react';
import { config } from '../config';
import { buildConvictionSnapshot } from '../convictionAnalytics';
import { formatTokenAmount } from '../dapp';
import type { EvidenceItem } from '../evidence';
import type { AppCopy } from '../i18n';
import { loadMarketHistory, toOutcomeCurvePoints, type MarketHistoryEvent } from '../marketEvents';
import type { MarketSummary } from '../marketData';
import { loadMarketMechanismState, type MarketMechanismState } from '../marketMechanism';
import { loadHookPathProof, type HookPathProof } from '../marketProof';
import type { PortfolioPosition } from '../portfolio';
import { createJsonRpcClient } from '../rpcClient';
import type { WalletState } from '../wallet';
import { ActivityItem } from './ActivityFeed';
import { ConvictionEnginePanel } from './ConvictionEnginePanel';
import { ExitTaxCurve } from './ExitTaxCurve';
import { MarketInfoTabs } from './MarketInfoTabs';
import { MarketStatusBanner } from './MarketStatusBanner';
import { OutcomeCurve } from './OutcomeCurve';
import { TradingPanel } from './TradingPanel';

const detailRpc = config.rpcUrl ? createJsonRpcClient(config.rpcUrl) : null;

export function MarketDetailPage({
  market,
  position,
  wallet,
  activities,
  evidence,
  initialOutcome,
  copy,
  onConnect,
  onMarketRefresh,
  onActivity,
}: {
  market: MarketSummary;
  position?: PortfolioPosition;
  wallet: WalletState;
  activities: ActivityItem[];
  evidence: EvidenceItem[];
  initialOutcome?: 'yes' | 'no';
  copy: AppCopy;
  onConnect: () => Promise<void>;
  onMarketRefresh: () => Promise<void>;
  onActivity: (item: ActivityItem) => void;
}) {
  const yes = Number(market.yesProbability) / 1e16;
  const no = Number(market.noProbability) / 1e16;
  const [history, setHistory] = useState<MarketHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mechanism, setMechanism] = useState<MarketMechanismState | undefined>();
  const [proof, setProof] = useState<HookPathProof | undefined>();
  const snapshot = buildConvictionSnapshot({ market, mechanism, position });

  const loadDetailData = useCallback(async () => {
    if (!detailRpc) {
      setHistory([]);
      setMechanism(undefined);
      setProof(undefined);
      return;
    }

    setHistoryLoading(true);
    const [historyResult, mechanismResult] = await Promise.allSettled([
      loadMarketHistory(detailRpc, market.address),
      loadMarketMechanismState(detailRpc, market.address),
    ]);
    const nextHistory = historyResult.status === 'fulfilled' ? historyResult.value : [];
    const nextMechanism = mechanismResult.status === 'fulfilled' ? mechanismResult.value : undefined;
    const nextProof = await loadHookPathProof(
      detailRpc,
      {
        routerConfigured: Boolean(config.routerAddress),
        poolManagerAddress: config.poolManagerAddress,
        hookAddress: config.hookAddress,
        market: market.address,
      },
      nextHistory,
    ).catch(() => undefined);

    setHistory(nextHistory);
    setMechanism(nextMechanism);
    setProof(nextProof);
    setHistoryLoading(false);
  }, [market.address]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!detailRpc) return;
      setHistoryLoading(true);
      const [historyResult, mechanismResult] = await Promise.allSettled([
        loadMarketHistory(detailRpc, market.address),
        loadMarketMechanismState(detailRpc, market.address),
      ]);
      if (cancelled) return;

      const nextHistory = historyResult.status === 'fulfilled' ? historyResult.value : [];
      const nextMechanism = mechanismResult.status === 'fulfilled' ? mechanismResult.value : undefined;
      const nextProof = await loadHookPathProof(
        detailRpc,
        {
          routerConfigured: Boolean(config.routerAddress),
          poolManagerAddress: config.poolManagerAddress,
          hookAddress: config.hookAddress,
          market: market.address,
        },
        nextHistory,
      ).catch(() => undefined);
      if (cancelled) return;

      setHistory(nextHistory);
      setMechanism(nextMechanism);
      setProof(nextProof);
      setHistoryLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [market.address]);

  async function refreshDetailData() {
    await onMarketRefresh();
    await loadDetailData();
  }

  return (
    <section className="market-detail-page">
      <div className="detail-main">
        <MarketStatusBanner market={market} />
        <header className="page-header market-proof-hero">
          <div>
            <p className="eyebrow">Hook-native event asset</p>
            <h1>{market.question}</h1>
            <p>Every entry or exit routes through ConvictionRouter, PoolManager.swap, ConvictionHook, and ConvictionMarket. The Hook records conviction, applies exit tax, freezes the market, and feeds settlement.</p>
          </div>
          <div className="hero-stats">
            <span>{formatTokenAmount(market.collateralPool, 2)} cUSDC pool</span>
            <span>YES {yes.toFixed(1)}%</span>
            <span>{market.lifecycle}</span>
            <span>{new Date(Number(market.deadline) * 1000).toLocaleString()}</span>
          </div>
        </header>
        <OutcomeCurve yesProbability={yes} noProbability={no} points={toOutcomeCurvePoints(history)} loading={historyLoading} copy={copy.curve} />
        <div className="mechanism-layout">
          <ConvictionEnginePanel snapshot={snapshot} />
          <ExitTaxCurve snapshot={snapshot} deadline={market.deadline} />
        </div>
        <MarketInfoTabs market={market} position={position} activities={activities} evidence={evidence} snapshot={snapshot} proof={proof} history={history} />
      </div>
      <aside className="detail-rail">
        <TradingPanel
          market={market}
          yesProbability={yes}
          noProbability={no}
          wallet={wallet}
          onConnect={onConnect}
          onMarketRefresh={refreshDetailData}
          onActivity={onActivity}
          initialOutcome={initialOutcome}
          copy={copy.trading}
        />
      </aside>
    </section>
  );
}
