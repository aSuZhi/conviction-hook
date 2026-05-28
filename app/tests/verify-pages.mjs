import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.CONVICTION_APP_URL || 'http://127.0.0.1:5173';
const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fallbackMarket = process.env.VITE_CONVICTION_MARKET_ADDRESS || '0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c';
const useMockRpc = process.env.CONVICTION_MOCK_RPC === '1';

const routes = [
  ['/markets', 'Markets ready for conviction'],
  [`/markets/${fallbackMarket}?outcome=no`, 'Hook-native event asset'],
  ['/portfolio', 'Your conviction positions'],
  ['/wallet', 'Account readiness'],
  ['/activity', 'Transactions and receipt evidence'],
  ['/help', 'How Conviction works'],
  ['/risk', 'Risk disclosure'],
  ['/studio', 'Operator dashboard'],
  ['/studio/create', 'Create and register market'],
  ['/studio/markets', 'Market operations table'],
  ['/demo', 'Run the full on-chain betting flow with one wallet'],
  ['/judge', 'Run the full on-chain betting flow with one wallet'],
  ['/agent', 'Conviction Agent Skill'],
];

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-features=VizDisplayCompositor'],
});

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  if (useMockRpc) await desktop.addInitScript(createMockRpcEnvironment, { market: fallbackMarket });
  for (const [route, expectedText] of routes) {
    await desktop.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForText(desktop, route, expectedText);
    if (useMockRpc && route.startsWith('/markets/')) {
      for (const detailText of [
        'Indexed from ProbabilityUpdated events',
        'Market data console',
        'Ready to route through Hook',
      ]) {
        await waitForText(desktop, `market detail ${detailText}`, detailText);
      }
      await desktop.getByRole('button', { name: 'flow' }).click();
      await waitForText(desktop, 'market detail flow tab', 'Execution path');
    } else if (route.startsWith('/markets/')) {
      await waitForAnyText(desktop, route, ['Indexed from ProbabilityUpdated events', 'No historical conviction events yet']);
    }
    if (route.startsWith('/markets/')) {
      const hookPathHeadings = await desktop.locator('text=Router to Hook to Market').count();
      assert.ok(hookPathHeadings <= 1, `market detail should not repeat Hook Path panel, found ${hookPathHeadings}`);
    }
    const bodyText = await desktop.locator('body').innerText();
    assert.match(bodyText, new RegExp(escapeRegExp(expectedText), 'i'));
    await desktop.screenshot({ path: `verify-${routeName(route)}-desktop.png`, fullPage: true });
  }

  await desktop.goto(`${baseUrl}/markets`, { waitUntil: 'domcontentloaded' });
  await desktop.evaluate(() => window.history.pushState({}, '', '/portfolio'));
  await waitForText(desktop, 'pushState /portfolio', 'Your conviction positions');
  await desktop.evaluate((market) => window.history.replaceState({}, '', `/markets/${market}?outcome=yes`), fallbackMarket);
  await waitForText(desktop, 'replaceState market detail', 'Hook-native event asset');
  await desktop.getByRole('button', { name: 'Markets' }).click();
  await waitForText(desktop, 'click Markets nav', 'Markets ready for conviction');
  await desktop.getByRole('button', { name: 'Portfolio', exact: true }).click();
  await waitForText(desktop, 'click Portfolio nav', 'Your conviction positions');
  await desktop.getByRole('button', { name: 'Activity' }).click();
  await waitForText(desktop, 'click Activity nav', 'Transactions and receipt evidence');
  await desktop.getByRole('button', { name: 'Demo' }).click();
  await waitForText(desktop, 'click Demo nav', 'Run the full on-chain betting flow with one wallet');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 1100 }, isMobile: true });
  if (useMockRpc) await mobile.addInitScript(createMockRpcEnvironment, { market: fallbackMarket });
  for (const [route, expectedText] of [
    ['/markets', 'Markets ready for conviction'],
    [`/markets/${fallbackMarket}?outcome=yes`, 'Hook-native event asset'],
    ['/portfolio', 'Your conviction positions'],
    ['/demo', 'Run the full on-chain betting flow with one wallet'],
    ['/judge', 'Run the full on-chain betting flow with one wallet'],
    ['/agent', 'Conviction Agent Skill'],
  ]) {
    await mobile.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForText(mobile, route, expectedText);
    const hasHorizontalOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
    assert.equal(hasHorizontalOverflow, false, `${route} has horizontal overflow on mobile`);
    await mobile.screenshot({ path: `verify-${routeName(route)}-mobile.png`, fullPage: true });
  }
} finally {
  await browser.close();
}

console.log('browser verification passed');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitForText(page, route, expectedText) {
  try {
    await page.waitForFunction(
      (text) => document.body.innerText.toLowerCase().includes(text.toLowerCase()),
      expectedText,
      { timeout: 20_000 },
    );
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Timed out waiting for "${expectedText}" on ${route}. Body: ${body.slice(0, 800)}`, { cause: error });
  }
}

async function waitForAnyText(page, route, expectedTexts) {
  try {
    await page.waitForFunction(
      (texts) => {
        const body = document.body.innerText.toLowerCase();
        return texts.some((text) => body.includes(text.toLowerCase()));
      },
      expectedTexts,
      { timeout: 20_000 },
    );
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Timed out waiting for one of "${expectedTexts.join(', ')}" on ${route}. Body: ${body.slice(0, 800)}`, { cause: error });
  }
}

function routeName(route) {
  return route
    .replace(/^\//, '')
    .replace(/\?.*$/, '')
    .replaceAll('/', '-')
    .replaceAll(':', '-');
}

  function createMockRpcEnvironment({ market }) {
  const oneToken = 10n ** 18n;
  const account = '0x9999999999999999999999999999999999999999';
  const yesToken = '0x3333333333333333333333333333333333333333';
  const noToken = '0x4444444444444444444444444444444444444444';
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
    yesExposure: '0x005f7f28',
    noExposure: '0xf2f5170c',
    totalYesWeight: '0xd0bd83e5',
    totalNoWeight: '0xab227886',
    createdAt: '0xcf09e0d0',
    marketId: '0x6ed71ede',
    winningOutcome: '0x9b34ae03',
    resolvedCollateralPool: '0xa9677e87',
  };

  const provider = {
    isOkxWallet: true,
    request: async ({ method, params }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account];
      if (method === 'eth_chainId') return '0xc4';
      if (method === 'eth_call') {
        const call = params?.[0] ?? {};
        const data = String(call.data ?? '0x');
        if (data.startsWith('0x70a08231')) return word(10n * oneToken);
        if (data.startsWith('0xdd62ed3e')) return word(10n * oneToken);
        return word(0n);
      }
      return null;
    },
    on: () => {},
    removeListener: () => {},
  };

  window.okxwallet = provider;
  window.localStorage.setItem('conviction:last-wallet', 'okx');

  window.fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body ?? '{}'));
    if (request.method === 'eth_getLogs') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: mockMarketLogs(market) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (request.method === 'eth_getTransactionReceipt') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: mockReceipt(market) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const call = request.params?.[0] ?? {};
    const data = String(call.data ?? '0x');
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: rpcResult(data) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  function rpcResult(data) {
    if (data === selectors.marketsLength) return word(1n);
    if (data.startsWith(selectors.markets)) return addressWord(market);
    if (data === selectors.question) return abiString('Mock bettable OKB market');
    if (data === selectors.deadline) return word(BigInt(Math.floor(Date.now() / 1000) + 86400));
    if (data === selectors.probabilities) return word(580000000000000000n) + word(420000000000000000n).slice(2);
    if (data === selectors.collateralPool) return word(42n * oneToken);
    if (data === selectors.resolved || data === selectors.paused || data === selectors.voided) return word(0n);
    if (data === selectors.resolutionEvidenceURI || data === selectors.voidEvidenceURI) return '0x';
    if (data === selectors.yesToken) return addressWord(yesToken);
    if (data === selectors.noToken) return addressWord(noToken);
    if (data === selectors.yesExposure) return word(24n * oneToken);
    if (data === selectors.noExposure) return word(18n * oneToken);
    if (data === selectors.totalYesWeight) return word(36n * oneToken);
    if (data === selectors.totalNoWeight) return word(20n * oneToken);
    if (data === selectors.createdAt) return word(BigInt(Math.floor(Date.now() / 1000) - 3600));
    if (data === selectors.marketId) return `0x${'11'.repeat(32)}`;
    if (data === selectors.winningOutcome) return word(0n);
    if (data === selectors.resolvedCollateralPool) return word(0n);
    return word(0n);
  }

  function mockMarketLogs(logMarket) {
    return [
      probabilityLog(logMarket, 100n, 500000000000000000n, 500000000000000000n, '0x1'),
      enteredLog(logMarket, 101n, '0x2'),
      probabilityLog(logMarket, 102n, 580000000000000000n, 420000000000000000n, '0x3'),
    ];
  }

  function probabilityLog(logMarket, block, yes, no, logIndex) {
    return {
      address: logMarket,
      blockNumber: word(block),
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transactionIndex: '0x0',
      blockHash: `0x${'bb'.repeat(32)}`,
      logIndex,
      removed: false,
      topics: ['0x85018bec619abb6ce853de9daa190d054a9ede168962ca6c69eb70f17fe0d786', `0x${'11'.repeat(32)}`],
      data: word(yes) + word(no).slice(2),
    };
  }

  function enteredLog(logMarket, block, logIndex) {
    return {
      address: logMarket,
      blockNumber: word(block),
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transactionIndex: '0x0',
      blockHash: `0x${'bb'.repeat(32)}`,
      logIndex,
      removed: false,
      topics: [
        '0x353322d2c146d65e2ee3124ef29d1d2b3f9669b15efe89fdf0d538f6ddb19d01',
        addressTopic(account),
        `0x${'11'.repeat(32)}`,
      ],
      data: word(1n) + word(oneToken).slice(2) + word(2n * oneToken).slice(2),
    };
  }

  function mockReceipt(logMarket) {
    return {
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      blockNumber: '0x65',
      status: '0x1',
      logs: [
        { address: '0x360e68faccca8ca495c1b759fd9eee466db9fb32', topics: ['0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f'], data: '0x', blockNumber: '0x65', transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', logIndex: '0x1' },
        { address: '0x7cdA90700b2b2957C73D3fD3aFA0BA9F47e514C0', topics: ['0x9dff64abf697a4ba63fad8c5860123e8f64ec30c10898047e7db9ff48cde9b43'], data: '0x', blockNumber: '0x65', transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', logIndex: '0x2' },
        { address: logMarket, topics: ['0x353322d2c146d65e2ee3124ef29d1d2b3f9669b15efe89fdf0d538f6ddb19d01'], data: '0x', blockNumber: '0x65', transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', logIndex: '0x3' },
      ],
    };
  }

  function word(value) {
    return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
  }

  function addressWord(value) {
    return `0x${value.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
  }

  function addressTopic(value) {
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
