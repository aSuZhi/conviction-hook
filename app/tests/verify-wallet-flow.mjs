import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.CONVICTION_APP_URL || 'http://127.0.0.1:5173';
const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mock = {
  account: '0x1111111111111111111111111111111111111111',
  market: '0x2222222222222222222222222222222222222222',
  yesToken: '0x3333333333333333333333333333333333333333',
  noToken: '0x4444444444444444444444444444444444444444',
  claimTx: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-features=VizDisplayCompositor'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  await page.addInitScript(createMockEnvironment, mock);

  await page.goto(`${baseUrl}/portfolio`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.getByRole('button', { name: /OKX Wallet/i }).click();
  await waitForText(page, 'Mock resolved OKB market');

  const bodyAfterConnect = await page.locator('body').innerText();
  assert.match(bodyAfterConnect, /0x1111/i, 'connected account should appear in nav');
  assert.match(bodyAfterConnect, /X Layer\s+●/i, 'nav should show X Layer after wallet switch');
  assert.match(bodyAfterConnect, /Mock resolved OKB market/i, 'mock portfolio row should load');
  assert.match(bodyAfterConnect, /5\.00/i, 'claimable amount should be visible');
  assert.equal(await page.evaluate(() => window.__xLayerSwitchCount), 1, 'connect should request X Layer network switch');

  await page.getByRole('button', { name: 'Claim', exact: true }).first().click();
  await page.getByRole('button', { name: 'Activity' }).click();
  await waitForText(page, '0xaaaaaaaa');

  const activityText = await page.locator('body').innerText();
  assert.match(activityText, /Claim/i, 'claim activity should be recorded after claim CTA');
  assert.match(activityText, /0xaaaaaaaa\.\.\.aaaaaa/i, 'claim receipt hash should be visible');

  await page.goto(`${baseUrl}/markets/${mock.market}?outcome=no`, { waitUntil: 'networkidle' });
  await waitForText(page, 'Hook-native event asset');
  const detailText = await page.locator('body').innerText();
  assert.match(detailText, /Mock resolved OKB market/i, 'detail page should load the selected market directly');
  assert.match(detailText, /NO\s+Will OKB fail to trade above target\?/i, 'NO quick action should preselect the trade ticket');

  await page.getByRole('button', { name: /0x1111/i }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await waitForText(page, 'Connect');
  assert.equal(await page.evaluate(() => window.__walletRevokeCount), 1, 'disconnect should attempt account permission revocation');
  assert.doesNotMatch(await page.locator('body').innerText(), /0x1111…1111/i, 'connected account should be cleared after disconnect');

  await page.screenshot({ path: 'verify-wallet-flow-desktop.png', fullPage: true });
} finally {
  await browser.close();
}

console.log('wallet flow verification passed');

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.toLowerCase().includes(expected.toLowerCase()),
    text,
    { timeout: 20_000 },
  );
}

function createMockEnvironment({ account, market, yesToken, noToken, claimTx }) {
  const oneToken = 10n ** 18n;
  let chainId = '0x1';
  window.__xLayerSwitchCount = 0;
  window.__walletRevokeCount = 0;
  const selectors = {
    marketsLength: '0xa5402544',
    markets: '0xb1283e77',
    question: '0x3fad9ae0',
    deadline: '0x29dcb0cf',
    probabilities: '0x3c0de47c',
    collateralPool: '0xff0eccf6',
    resolved: '0x3f6fa655',
    paused: '0x5c975abb',
    voided: '0xb15856e4',
    resolutionEvidenceURI: '0x28875629',
    voidEvidenceURI: '0xbd4f9352',
    yesToken: '0xf0d9bb20',
    noToken: '0x11a9f10a',
    positionOf: '0xfd2d39c5',
    claimable: '0x402914f5',
    claim: '0x1e83409a',
    balanceOf: '0x70a08231',
    allowance: '0xdd62ed3e',
  };

  window.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body ?? '{}'));
    const call = request.params?.[0] ?? {};
    const result = rpcResult(String(call.data ?? '0x'));
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const provider = {
    isOkxWallet: true,
    async request({ method, params }) {
      if (method === 'eth_accounts') return localStorage.getItem('mockAuthorized') === '1' ? [account] : [];
      if (method === 'eth_requestAccounts') {
        localStorage.setItem('mockAuthorized', '1');
        return [account];
      }
      if (method === 'eth_chainId') return chainId;
      if (method === 'wallet_revokePermissions') {
        localStorage.setItem('mockAuthorized', '0');
        window.__walletRevokeCount += 1;
        return null;
      }
      if (method === 'wallet_switchEthereumChain') {
        if (params?.[0]?.chainId !== '0xc4') throw new Error(`Unexpected chain switch: ${params?.[0]?.chainId}`);
        chainId = '0xc4';
        window.__xLayerSwitchCount += 1;
        return null;
      }
      if (method === 'wallet_addEthereumChain') {
        chainId = String(params?.[0]?.chainId ?? '0xc4');
        return null;
      }
      if (method === 'eth_call') return providerCall(String(params?.[0]?.data ?? '0x'));
      if (method === 'eth_sendTransaction') {
        const data = String(params?.[0]?.data ?? '0x');
        if (!data.startsWith(selectors.claim)) throw new Error(`Unexpected transaction data: ${data}`);
        return claimTx;
      }
      if (method === 'eth_getTransactionReceipt') return { status: '0x1', logs: [] };
      throw new Error(`Unexpected provider method: ${method}`);
    },
  };
  window.ethereum = {
    isMetaMask: true,
    async request({ method }) {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_chainId') return '0x1';
      throw new Error(`Unexpected MetaMask mock method: ${method}`);
    },
  };
  window.addEventListener('eip6963:requestProvider', () => {
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: { uuid: 'okx-mock', name: 'OKX Wallet', rdns: 'com.okx.wallet' },
            provider,
          },
        }),
      );
    }, 50);
  });

  function rpcResult(data) {
    if (data === selectors.marketsLength) return word(1n);
    if (data.startsWith(selectors.markets)) return addressWord(market);
    if (data === selectors.question) return abiString('Mock resolved OKB market');
    if (data === selectors.deadline) return word(BigInt(Math.floor(Date.now() / 1000) - 60));
    if (data === selectors.probabilities) return word(600000000000000000n) + word(400000000000000000n).slice(2);
    if (data === selectors.collateralPool) return word(25n * oneToken);
    if (data === selectors.resolved) return word(1n);
    if (data === selectors.paused || data === selectors.voided) return word(0n);
    if (data === selectors.resolutionEvidenceURI) return abiString('ipfs://mock-settlement-proof');
    if (data === selectors.voidEvidenceURI) return '0x';
    if (data === selectors.yesToken) return addressWord(yesToken);
    if (data === selectors.noToken) return addressWord(noToken);
    return word(0n);
  }

  function providerCall(data) {
    if (data.startsWith(selectors.positionOf)) {
      return words(1n * oneToken, 0n, 2n * oneToken, 0n, 0n, 0n, 0n);
    }
    if (data.startsWith(selectors.claimable)) return word(5n * oneToken);
    if (data.startsWith(selectors.balanceOf)) return word(100n * oneToken);
    if (data.startsWith(selectors.allowance)) return word(100n * oneToken);
    return word(0n);
  }

  function word(value) {
    return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
  }

  function words(...values) {
    return `0x${values.map((value) => word(value).slice(2)).join('')}`;
  }

  function addressWord(value) {
    return `0x${value.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
  }

  function abiString(value) {
    const bytes = Array.from(new TextEncoder().encode(value));
    const length = word(BigInt(bytes.length)).slice(2);
    const data = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const paddedData = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
    return `0x${word(32n).slice(2)}${length}${paddedData}`;
  }
}
