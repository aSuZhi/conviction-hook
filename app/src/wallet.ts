import { config } from './config';

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isOKXWallet?: boolean;
  isOKExWallet?: boolean;
  providers?: EthereumProvider[];
};

type Eip6963ProviderDetail = {
  info?: {
    uuid?: string;
    name?: string;
    rdns?: string;
  };
  provider?: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: EthereumProvider;
    okxWallet?: EthereumProvider;
    okx?: { ethereum?: EthereumProvider } | EthereumProvider;
  }
}

export type WalletConnectorId = 'okx' | 'metamask' | 'injected';

export type WalletConnector = {
  id: WalletConnectorId;
  name: string;
  provider: EthereumProvider | null;
  installed: boolean;
  recommended?: boolean;
  lastUsed?: boolean;
};

export type WalletState = {
  provider: EthereumProvider | null;
  account: `0x${string}` | null;
  chainId: number | null;
  connectorId: WalletConnectorId | null;
  walletName: string | null;
};

const LAST_WALLET_KEY = 'conviction:last-wallet';
const eip6963Providers: Eip6963ProviderDetail[] = [];
const walletDiscoveryListeners = new Set<() => void>();
let walletDiscoveryStarted = false;

export const emptyWallet: WalletState = { provider: null, account: null, chainId: null, connectorId: null, walletName: null };

export function startWalletDiscovery(onChange?: () => void) {
  if (onChange) walletDiscoveryListeners.add(onChange);
  if (!walletDiscoveryStarted) {
    walletDiscoveryStarted = true;
    window.addEventListener('eip6963:announceProvider', handleEip6963Provider as EventListener);
  }
  requestWalletDiscovery();

  return () => {
    if (onChange) walletDiscoveryListeners.delete(onChange);
  };
}

export function requestWalletDiscovery() {
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export function listWalletConnectors(): WalletConnector[] {
  const lastUsed = getLastWalletId();
  const okxProvider = findOkxProvider();
  const metamaskProvider = findEip6963Provider(isMetaMaskInfo) ?? findProvider((provider) => Boolean(provider.isMetaMask));
  const browserProvider =
    window.ethereum && window.ethereum !== okxProvider && window.ethereum !== metamaskProvider ? window.ethereum : null;

  return [
    {
      id: 'okx',
      name: 'OKX Wallet',
      provider: okxProvider,
      installed: Boolean(okxProvider),
      recommended: true,
      lastUsed: lastUsed === 'okx',
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      provider: metamaskProvider,
      installed: Boolean(metamaskProvider),
      lastUsed: lastUsed === 'metamask',
    },
    {
      id: 'injected',
      name: 'Browser Wallet',
      provider: browserProvider,
      installed: Boolean(browserProvider),
      lastUsed: lastUsed === 'injected',
    },
  ];
}

export function getInjectedProvider(connectorId?: WalletConnectorId) {
  return getWalletConnector(connectorId).provider;
}

export async function connectWallet(connectorId?: WalletConnectorId): Promise<WalletState> {
  const connector = getWalletConnector(connectorId);
  const provider = connector.provider;
  if (!provider) throw new WalletError('NO_WALLET');

  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new WalletError('NO_ACCOUNT');

  const chainId = await ensureXLayer(provider);
  localStorage.setItem(LAST_WALLET_KEY, connector.id);
  return { provider, account: accounts[0] as `0x${string}`, chainId, connectorId: connector.id, walletName: connector.name };
}

export async function disconnectWallet(wallet: WalletState) {
  if (!wallet.provider) return;

  try {
    await wallet.provider.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Some injected wallets do not support permission revocation. Clearing DApp state still logs out locally.
  }
}

export async function ensureXLayer(provider: EthereumProvider) {
  const currentChainId = await readChainId(provider);
  if (currentChainId === config.chainId) return currentChainId;

  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xc4' }] });
  } catch (error) {
    const code = getProviderErrorCode(error);
    if (code !== 4902) throw error;

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0xc4',
          chainName: 'X Layer Mainnet',
          nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
          rpcUrls: [config.rpcUrl || 'https://rpc.xlayer.tech'],
          blockExplorerUrls: ['https://www.oklink.com/xlayer'],
        },
      ],
    });

    if ((await readChainId(provider)) !== config.chainId) {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xc4' }] });
    }
  }

  return readChainId(provider);
}

export async function refreshWallet(): Promise<WalletState> {
  const connector = getWalletConnector();
  const provider = connector.provider;
  if (!provider) return emptyWallet;
  const accounts = await provider.request<string[]>({ method: 'eth_accounts' });
  const chainIdHex = await provider.request<string>({ method: 'eth_chainId' });
  return {
    provider,
    account: accounts[0] ? (accounts[0] as `0x${string}`) : null,
    chainId: Number.parseInt(chainIdHex, 16),
    connectorId: connector.id,
    walletName: connector.name,
  };
}

async function readChainId(provider: EthereumProvider) {
  const chainIdHex = await provider.request<string>({ method: 'eth_chainId' });
  return Number.parseInt(chainIdHex, 16);
}

export class WalletError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function getProviderErrorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : undefined;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getWalletConnector(connectorId?: WalletConnectorId) {
  const connectors = listWalletConnectors();
  const preferredId = connectorId ?? getLastWalletId() ?? 'okx';
  return (
    connectors.find((connector) => connector.id === preferredId && connector.installed) ??
    connectors.find((connector) => connector.id === 'okx' && connector.installed) ??
    connectors.find((connector) => connector.installed) ??
    connectors[0]
  );
}

function getLastWalletId(): WalletConnectorId | null {
  const value = localStorage.getItem(LAST_WALLET_KEY);
  return value === 'okx' || value === 'metamask' || value === 'injected' ? value : null;
}

function findOkxProvider() {
  return window.okxwallet ?? window.okxWallet ?? getOkxGlobalProvider() ?? findEip6963Provider(isOkxInfo) ?? findProvider(isOkxProvider);
}

function findProvider(match: (provider: EthereumProvider) => boolean) {
  return getProviderCandidates().find(match) ?? null;
}

function getProviderCandidates() {
  const candidates = [
    window.okxwallet,
    window.okxWallet,
    getOkxGlobalProvider(),
    ...eip6963Providers.map((detail) => detail.provider),
    ...(window.ethereum?.providers ?? []),
    window.ethereum,
  ].filter(Boolean) as EthereumProvider[];
  return candidates.filter((provider, index) => candidates.indexOf(provider) === index);
}

function isOkxProvider(provider: EthereumProvider) {
  return Boolean(provider.isOkxWallet || provider.isOKXWallet || provider.isOKExWallet || hasWalletHint(provider, 'okx'));
}

function handleEip6963Provider(event: CustomEvent<Eip6963ProviderDetail>) {
  const detail = event.detail;
  if (!detail?.provider) return;

  const key = detail.info?.uuid || detail.info?.rdns || detail.info?.name || '';
  const exists = eip6963Providers.some((item) => item.provider === detail.provider || (key && getEip6963Key(item) === key));
  if (!exists) {
    eip6963Providers.push(detail);
    walletDiscoveryListeners.forEach((listener) => listener());
  }
}

function findEip6963Provider(match: (detail: Eip6963ProviderDetail) => boolean) {
  return eip6963Providers.find((detail) => detail.provider && match(detail))?.provider ?? null;
}

function isOkxInfo(detail: Eip6963ProviderDetail) {
  return hasWalletHint(detail.info, 'okx') || hasWalletHint(detail.info, 'okex') || Boolean(detail.provider && isOkxProvider(detail.provider));
}

function isMetaMaskInfo(detail: Eip6963ProviderDetail) {
  return hasWalletHint(detail.info, 'metamask') || Boolean(detail.provider?.isMetaMask);
}

function getEip6963Key(detail: Eip6963ProviderDetail) {
  return detail.info?.uuid || detail.info?.rdns || detail.info?.name || '';
}

function getOkxGlobalProvider() {
  if (!window.okx) return null;
  if ('request' in window.okx) return window.okx as EthereumProvider;
  return window.okx.ethereum ?? null;
}

function hasWalletHint(value: unknown, hint: string) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((item) => typeof item === 'string' && item.toLowerCase().includes(hint));
}

export type { EthereumProvider };
