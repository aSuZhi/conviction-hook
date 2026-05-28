import { useEffect, useMemo, useRef, useState } from 'react';
import { AgentConsolePage } from './components/AgentConsolePage';
import { AppShell } from './components/AppShell';
import { DemoJourneyPage } from './components/DemoJourneyPage';
import { HelpPage } from './components/HelpPage';
import { MarketDetailPage } from './components/MarketDetailPage';
import { MarketDiscoveryPage } from './components/MarketDiscoveryPage';
import { PortfolioPage } from './components/PortfolioPage';
import { RiskDisclosurePage } from './components/RiskDisclosurePage';
import { StatusState } from './components/StatusState';
import { StudioCreatePage } from './components/StudioCreatePage';
import { StudioDashboardPage } from './components/StudioDashboardPage';
import { StudioMarketOperationsPage } from './components/StudioMarketOperationsPage';
import { StudioMarketsPage } from './components/StudioMarketsPage';
import { StudioShell } from './components/StudioShell';
import { TransactionActivityPage } from './components/TransactionActivityPage';
import { UserDappShell } from './components/UserDappShell';
import { WalletPage } from './components/WalletPage';
import { WalletAccountModal } from './components/WalletAccountModal';
import { WalletConnectModal } from './components/WalletConnectModal';
import { withTimeout } from './asyncGuards';
import { config } from './config';
import { activityToEvidence, loadImportedAgentEvidence, type EvidenceItem } from './evidence';
import { copy, type Language } from './i18n';
import { loadMarket, loadMarkets, type MarketSummary } from './marketData';
import { claimMarket, loadPortfolio, type PortfolioPosition } from './portfolio';
import { isStudioRoute, parseRoute, routeToPath, type AppRoute } from './routes';
import {
  connectWallet,
  disconnectWallet,
  emptyWallet,
  getInjectedProvider,
  listWalletConnectors,
  requestWalletDiscovery,
  refreshWallet,
  startWalletDiscovery,
  type WalletConnectorId,
  type WalletState,
} from './wallet';
import type { ActivityItem } from './components/ActivityFeed';

const LOCATION_CHANGE_EVENT = 'conviction:locationchange';
const MARKET_LOAD_TIMEOUT_MS = 15_000;

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loadState, setLoadState] = useState<'demo' | 'loading' | 'live' | 'error'>('demo');
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [agentEvidenceVersion, setAgentEvidenceVersion] = useState(0);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('conviction-language') === 'zh' ? 'zh' : 'en'));
  const [wallet, setWallet] = useState<WalletState>(emptyWallet);
  const [connectBusy, setConnectBusy] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAccountOpen, setWalletAccountOpen] = useState(false);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [walletDiscoveryVersion, setWalletDiscoveryVersion] = useState(0);
  const marketLoadRequestId = useRef(0);
  const marketsRef = useRef<MarketSummary[]>([]);
  const t = copy[language];

  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  const evidence = useMemo<EvidenceItem[]>(
    () => [...activities.map(activityToEvidence), ...loadImportedAgentEvidence(), ...deploymentEvidence(markets)],
    [activities, agentEvidenceVersion, markets],
  );
  const routeMarketAddress = route.kind === 'marketDetail' || route.kind === 'studioMarketOperations' ? route.marketAddress.toLowerCase() : null;
  const activeMarket = routeMarketAddress
    ? markets.find((market) => market.address.toLowerCase() === routeMarketAddress) ?? markets[0] ?? null
    : markets[0] ?? null;
  const activePosition = activeMarket
    ? positions.find((position) => position.market.address.toLowerCase() === activeMarket.address.toLowerCase())
    : undefined;
  const walletOptions = useMemo(() => listWalletConnectors(), [wallet.account, wallet.connectorId, walletModalOpen, walletDiscoveryVersion]);

  useEffect(() => {
    void refreshMarkets();
    void refreshWallet().then(setWallet);
    const stopWalletDiscovery = startWalletDiscovery(() => {
      setWalletDiscoveryVersion((version) => version + 1);
      void refreshWallet().then(setWallet).catch(() => setWallet(emptyWallet));
    });
    const provider = getInjectedProvider();
    const syncRoute = () => setRoute(parseRoute());
    const syncWallet = () => void refreshWallet().then(setWallet).catch(() => setWallet(emptyWallet));
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args: Parameters<History['pushState']>) {
      originalPushState.apply(window.history, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    };
    window.history.replaceState = function replaceState(...args: Parameters<History['replaceState']>) {
      originalReplaceState.apply(window.history, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    };

    window.addEventListener('popstate', syncRoute);
    window.addEventListener(LOCATION_CHANGE_EVENT, syncRoute);
    provider?.on?.('accountsChanged', syncWallet);
    provider?.on?.('chainChanged', syncWallet);
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener(LOCATION_CHANGE_EVENT, syncRoute);
      stopWalletDiscovery();
      provider?.removeListener?.('accountsChanged', syncWallet);
      provider?.removeListener?.('chainChanged', syncWallet);
    };
  }, []);

  useEffect(() => {
    if (!walletModalOpen) return;
    requestWalletDiscovery();
    setWalletDiscoveryVersion((version) => version + 1);
    const refreshTimers = [
      window.setTimeout(() => {
        requestWalletDiscovery();
        setWalletDiscoveryVersion((version) => version + 1);
      }, 300),
      window.setTimeout(() => {
        requestWalletDiscovery();
        setWalletDiscoveryVersion((version) => version + 1);
      }, 900),
    ];
    return () => refreshTimers.forEach((timer) => window.clearTimeout(timer));
  }, [walletModalOpen]);

  useEffect(() => {
    void refreshPortfolio();
  }, [wallet.account, wallet.provider, markets]);

  useEffect(() => {
    if (route.kind !== 'marketDetail') return;
    const exists = markets.some((market) => market.address.toLowerCase() === route.marketAddress.toLowerCase());
    if (!exists && loadState !== 'loading') void refreshRouteMarket(route.marketAddress);
  }, [loadState, markets, route]);

  useEffect(() => {
    localStorage.setItem('conviction-language', language);
  }, [language]);

  async function refreshMarkets() {
    const requestId = ++marketLoadRequestId.current;
    if (markets.length === 0) setLoadState('loading');

    try {
      const nextMarkets = await withTimeout(loadMarketSnapshot(), MARKET_LOAD_TIMEOUT_MS, 'Market loading timed out');
      if (requestId !== marketLoadRequestId.current) return;
      setMarkets((current) => mergeMarkets(nextMarkets, current));
      setLoadState(nextMarkets.length > 0 ? 'live' : 'demo');
    } catch (error) {
      if (requestId !== marketLoadRequestId.current) return;
      if (marketsRef.current.length === 0) setLoadState('error');
    }
  }

  async function refreshRouteMarket(address: `0x${string}`) {
    try {
      const market = await loadMarket(address);
      setMarkets((current) => {
        const remaining = current.filter((item) => item.address.toLowerCase() !== address.toLowerCase());
        return [market, ...remaining];
      });
      setLoadState('live');
    } catch {
      if (markets.length === 0) setLoadState('error');
    }
  }

  async function ensureMarket(address: `0x${string}`) {
    const existing = marketsRef.current.find((market) => market.address.toLowerCase() === address.toLowerCase());
    if (existing) return existing;

    const market = await loadMarket(address);
    setMarkets((current) => mergeMarkets([market], current));
    setLoadState('live');
    return market;
  }

  async function refreshPortfolio() {
    if (!wallet.provider || !wallet.account || markets.length === 0) {
      setPositions([]);
      return;
    }
    setPositions(await loadPortfolio(wallet.provider, wallet.account, markets));
  }

  async function handleOpenConnect() {
    requestWalletDiscovery();
    setWalletModalOpen(true);
  }

  async function handleOpenWalletAccount() {
    setWalletAccountOpen(true);
  }

  async function handleConnect(connectorId: WalletConnectorId) {
    setConnectBusy(true);
    try {
      const nextWallet = await connectWallet(connectorId);
      setWallet(nextWallet);
      setWalletModalOpen(false);
    } finally {
      setConnectBusy(false);
    }
  }

  async function handleDisconnect() {
    setDisconnectBusy(true);
    try {
      await disconnectWallet(wallet);
      setWallet(emptyWallet);
      setPositions([]);
      setWalletAccountOpen(false);
    } finally {
      setDisconnectBusy(false);
    }
  }

  function handleChangeWallet() {
    setWalletAccountOpen(false);
    setWalletModalOpen(true);
  }

  function navigate(nextRoute: AppRoute) {
    const path = routeToPath(nextRoute);
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
  }

  async function refreshMarketAndPortfolio() {
    await refreshMarkets();
    await refreshPortfolio();
  }

  async function handleClaim(position: PortfolioPosition) {
    if (!wallet.provider || !wallet.account) return;
    setPortfolioBusy(true);
    try {
      const txHash = await claimMarket(wallet.provider, position.market.address, wallet.account);
      addActivity({ txHash, market: position.market.address, kind: 'claim', user: wallet.account, timestamp: Date.now() });
      await refreshPortfolio();
      await refreshMarkets();
    } finally {
      setPortfolioBusy(false);
    }
  }

  function addActivity(item: ActivityItem) {
    setActivities((current) => [item, ...current.filter((existing) => existing.txHash !== item.txHash)].slice(0, 24));
  }

  if (isStudioRoute(route)) {
    return (
      <>
        <StudioShell wallet={wallet} onConnect={handleOpenConnect} onDisconnect={handleOpenWalletAccount} onNavigate={navigate}>
          {renderStudioRoute()}
        </StudioShell>
        <WalletConnectModal
          open={walletModalOpen}
          language={language}
          options={walletOptions}
          busy={connectBusy}
          onClose={() => setWalletModalOpen(false)}
          onRefresh={() => {
            requestWalletDiscovery();
            setWalletDiscoveryVersion((version) => version + 1);
          }}
          onSelect={(connectorId) => void handleConnect(connectorId)}
        />
        <WalletAccountModal
          open={walletAccountOpen}
          language={language}
          wallet={wallet}
          busy={disconnectBusy}
          onClose={() => setWalletAccountOpen(false)}
          onDisconnect={() => void handleDisconnect()}
          onChangeWallet={handleChangeWallet}
        />
      </>
    );
  }

  return (
    <>
      <AppShell
        route={route}
        language={language}
        search={search}
        wallet={wallet}
        connectBusy={connectBusy}
        onSearchChange={setSearch}
        onNavigate={navigate}
        onToggleLanguage={() => setLanguage((current) => (current === 'en' ? 'zh' : 'en'))}
        onConnect={handleOpenConnect}
        onDisconnect={handleOpenWalletAccount}
      >
        <UserDappShell>{renderUserRoute()}</UserDappShell>
      </AppShell>
      <WalletConnectModal
        open={walletModalOpen}
        language={language}
        options={walletOptions}
        busy={connectBusy}
        onClose={() => setWalletModalOpen(false)}
        onRefresh={() => {
          requestWalletDiscovery();
          setWalletDiscoveryVersion((version) => version + 1);
        }}
        onSelect={(connectorId) => void handleConnect(connectorId)}
      />
      <WalletAccountModal
        open={walletAccountOpen}
        language={language}
        wallet={wallet}
        busy={disconnectBusy}
        onClose={() => setWalletAccountOpen(false)}
        onDisconnect={() => void handleDisconnect()}
        onChangeWallet={handleChangeWallet}
      />
    </>
  );

  function renderUserRoute() {
    if (route.kind === 'marketDetail') {
      if (!activeMarket && loadState === 'loading') {
        return <StatusState title="Loading market" body="Reading the selected market directly from X Layer." />;
      }
      if (!activeMarket) {
        return (
          <StatusState
            title="Market not found"
            body="The requested market is not available from the configured Factory or fallback market address."
            actionLabel="Back to markets"
            onAction={() => navigate({ kind: 'markets' })}
          />
        );
      }
      return (
        <MarketDetailPage
          market={activeMarket}
          position={activePosition}
          wallet={wallet}
          activities={activities}
          evidence={evidence}
          initialOutcome={route.outcome}
          copy={t}
          onConnect={handleOpenConnect}
          onMarketRefresh={refreshMarketAndPortfolio}
          onActivity={addActivity}
        />
      );
    }
    if (route.kind === 'portfolio') return <PortfolioPage positions={positions} busy={portfolioBusy} onClaim={handleClaim} onNavigate={navigate} />;
    if (route.kind === 'wallet') return <WalletPage wallet={wallet} onConnect={handleOpenConnect} onDisconnect={handleOpenWalletAccount} />;
    if (route.kind === 'activity') return <TransactionActivityPage activities={activities} />;
    if (route.kind === 'help') return <HelpPage />;
    if (route.kind === 'risk') return <RiskDisclosurePage />;
    if (route.kind === 'demo' || route.kind === 'judge') {
      return (
        <DemoJourneyPage
          markets={markets}
          positions={positions}
          wallet={wallet}
          evidence={evidence}
          language={language}
          tradingCopy={t.trading}
          onConnect={handleOpenConnect}
          onNavigate={navigate}
          onMarketRefresh={refreshMarketAndPortfolio}
          onEnsureMarket={ensureMarket}
          onActivity={addActivity}
        />
      );
    }
    if (route.kind === 'agent') {
      return (
        <AgentConsolePage
          wallet={wallet}
          evidence={evidence}
          language={language}
          onEvidenceImported={() => setAgentEvidenceVersion((value) => value + 1)}
        />
      );
    }
    return (
      <MarketDiscoveryPage
        markets={markets}
        positions={positions}
        loadState={loadState}
        search={search}
        copy={t.marketCard}
        onNavigate={navigate}
        onRetry={refreshMarkets}
      />
    );
  }

  function renderStudioRoute() {
    if (route.kind === 'studioMarkets') return <StudioMarketsPage markets={markets} onNavigate={navigate} />;
    if (route.kind === 'studioCreate') return <StudioCreatePage wallet={wallet} onRefresh={refreshMarkets} />;
    if (route.kind === 'studioMarketOperations') {
      return (
        <StudioMarketOperationsPage
          wallet={wallet}
          markets={markets}
          selectedMarket={activeMarket}
          onRefresh={refreshMarkets}
          onActivity={addActivity}
        />
      );
    }
    return <StudioDashboardPage wallet={wallet} markets={markets} evidence={evidence} />;
  }
}

async function loadMarketSnapshot() {
  const results = await Promise.allSettled([loadMarket(config.marketAddress), loadMarkets()]);
  const nextMarkets: MarketSummary[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    if (Array.isArray(result.value)) nextMarkets.push(...result.value);
    else nextMarkets.push(result.value);
  }

  if (nextMarkets.length === 0 && results.every((result) => result.status === 'rejected')) {
    throw new Error('No markets loaded');
  }

  return mergeMarkets(nextMarkets, []);
}

function mergeMarkets(preferred: MarketSummary[], existing: MarketSummary[]) {
  const byAddress = new Map<string, MarketSummary>();
  for (const market of [...existing, ...preferred]) {
    byAddress.set(market.address.toLowerCase(), market);
  }
  return Array.from(byAddress.values()).sort((left, right) => {
    if (left.deadline < right.deadline) return -1;
    if (left.deadline > right.deadline) return 1;
    return 0;
  });
}

function deploymentEvidence(markets: MarketSummary[]): EvidenceItem[] {
  return markets.slice(0, 1).map((market) => ({
    id: `deployment-${market.address}`,
    kind: 'deploy',
    label: 'Configured demo market',
    market: market.address,
    source: 'deployment',
    timestamp: Date.now(),
  }));
}
