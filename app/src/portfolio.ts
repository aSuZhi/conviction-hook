import type { MarketSummary } from './marketData';
import type { EthereumProvider } from './wallet';

export type PortfolioPosition = {
  market: MarketSummary;
  yesAmount: bigint;
  noAmount: bigint;
  yesWeight: bigint;
  noWeight: bigint;
  claimable: bigint;
  claimed: boolean;
};

const POSITION_OF_SELECTOR = '0xfd2d39c5';
const CLAIMABLE_SELECTOR = '0x402914f5';
const CLAIM_SELECTOR = '0x1e83409a';

export async function loadPortfolio(provider: EthereumProvider, account: `0x${string}`, markets: MarketSummary[]) {
  const results = await Promise.allSettled(markets.map((market) => loadPosition(provider, account, market)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

export async function claimMarket(provider: EthereumProvider, market: `0x${string}`, account: `0x${string}`) {
  const hash = await provider.request<`0x${string}`>({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: market, data: CLAIM_SELECTOR + encodeAddress(account) }],
  });
  await waitForReceipt(provider, hash);
  return hash;
}

async function loadPosition(
  provider: EthereumProvider,
  account: `0x${string}`,
  market: MarketSummary,
): Promise<PortfolioPosition> {
  const [positionHex, claimableHex] = await Promise.all([
    ethCall(provider, market.address, POSITION_OF_SELECTOR + encodeAddress(account)),
    ethCall(provider, market.address, CLAIMABLE_SELECTOR + encodeAddress(account)),
  ]);
  const words = decodeWords(positionHex);
  return {
    market,
    yesAmount: words[0] ?? 0n,
    noAmount: words[1] ?? 0n,
    yesWeight: words[2] ?? 0n,
    noWeight: words[3] ?? 0n,
    claimable: BigInt(claimableHex || '0x0'),
    claimed: (words[6] ?? 0n) === 1n,
  };
}

async function ethCall(provider: EthereumProvider, to: `0x${string}`, data: string) {
  return provider.request<string>({ method: 'eth_call', params: [{ to, data }, 'latest'] });
}

function decodeWords(hex: string) {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Array.from({ length: Math.floor(body.length / 64) }, (_, index) =>
    BigInt(`0x${body.slice(index * 64, index * 64 + 64)}`),
  );
}

function encodeAddress(address: string) {
  return '0'.repeat(24) + address.toLowerCase().replace(/^0x/, '');
}

async function waitForReceipt(provider: EthereumProvider, hash: `0x${string}`) {
  for (;;) {
    const receipt = await provider.request<{ status?: string } | null>({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') throw new Error('Transaction reverted');
      return receipt;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}
