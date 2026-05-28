import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const outDir = path.join(root, '.unit-test-dist');
const sourceFiles = [
  'config.ts',
  'routes.ts',
  'marketAnalytics.ts',
  'portfolioAnalytics.ts',
  'convictionAnalytics.ts',
  'evidence.ts',
  'rpcClient.ts',
  'marketEvents.ts',
  'marketMechanism.ts',
  'marketProof.ts',
  'tradeReadiness.ts',
  'asyncGuards.ts',
  'demoJourney.ts',
  'portfolio.ts',
  'dapp.ts',
];

await mkdir(outDir, { recursive: true });

for (const file of sourceFiles) {
  const sourcePath = path.join(root, 'src', file);
  const source = await readFile(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: file,
  });
  const output = compiled.outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
  await writeFile(path.join(outDir, file.replace(/\.ts$/, '.mjs')), output);
}

const routes = await import(pathToFileURL(path.join(outDir, 'routes.mjs')));
const marketAnalytics = await import(pathToFileURL(path.join(outDir, 'marketAnalytics.mjs')));
const portfolioAnalytics = await import(pathToFileURL(path.join(outDir, 'portfolioAnalytics.mjs')));
const convictionAnalytics = await import(pathToFileURL(path.join(outDir, 'convictionAnalytics.mjs')));
const evidence = await import(pathToFileURL(path.join(outDir, 'evidence.mjs')));
const rpcClient = await import(pathToFileURL(path.join(outDir, 'rpcClient.mjs')));
const marketEvents = await import(pathToFileURL(path.join(outDir, 'marketEvents.mjs')));
const marketProof = await import(pathToFileURL(path.join(outDir, 'marketProof.mjs')));
const tradeReadiness = await import(pathToFileURL(path.join(outDir, 'tradeReadiness.mjs')));
const asyncGuards = await import(pathToFileURL(path.join(outDir, 'asyncGuards.mjs')));
const demoJourney = await import(pathToFileURL(path.join(outDir, 'demoJourney.mjs')));
const portfolioModule = await import(pathToFileURL(path.join(outDir, 'portfolio.mjs')));
const dapp = await import(pathToFileURL(path.join(outDir, 'dapp.mjs')));

function market(overrides = {}) {
  return {
    address: '0x0000000000000000000000000000000000000001',
    question: 'Will OKB trade above target?',
    deadline: 2_000n,
    yesProbability: 620000000000000000n,
    noProbability: 380000000000000000n,
    collateralPool: 1000000000000000000n,
    resolved: false,
    paused: false,
    voided: false,
    yesToken: '0x0000000000000000000000000000000000000002',
    noToken: '0x0000000000000000000000000000000000000003',
    lifecycle: 'bettable',
    ...overrides,
  };
}

assert.equal(routes.parseRoute('/markets').kind, 'markets');
assert.equal(routes.parseRoute('/demo').kind, 'demo');
assert.equal(routes.parseRoute('/judge').kind, 'demo');
assert.deepEqual(routes.parseRoute('/markets/0x0000000000000000000000000000000000000001'), {
  kind: 'marketDetail',
  marketAddress: '0x0000000000000000000000000000000000000001',
  outcome: undefined,
});
assert.deepEqual(routes.parseRoute('/markets/0x0000000000000000000000000000000000000001', '?outcome=no'), {
  kind: 'marketDetail',
  marketAddress: '0x0000000000000000000000000000000000000001',
  outcome: 'no',
});
assert.equal(routes.routeToPath({ kind: 'marketDetail', marketAddress: '0x0000000000000000000000000000000000000001', outcome: 'yes' }), '/markets/0x0000000000000000000000000000000000000001?outcome=yes');
assert.equal(routes.routeToPath({ kind: 'studioMarketOperations', marketAddress: '0x0000000000000000000000000000000000000001' }), '/studio/markets/0x0000000000000000000000000000000000000001');
assert.equal(routes.routeToPath({ kind: 'demo' }), '/demo');

assert.equal(demoJourney.encodeOutcome('yes'), 1n);
assert.equal(demoJourney.encodeOutcome('no'), 2n);
assert.equal(demoJourney.encodeSettleDemoMarketData('yes', 'demo://settled').startsWith('0x4b44db41'), true);
assert.equal(demoJourney.isActiveDemoSessionMarket(null), false);
assert.equal(demoJourney.isActiveDemoSessionMarket(market({ lifecycle: 'bettable' })), true);
assert.equal(demoJourney.isActiveDemoSessionMarket(market({ lifecycle: 'resolved', resolved: true })), false);
assert.equal(demoJourney.isActiveDemoSessionMarket(market({ lifecycle: 'expired' })), false);
assert.equal(demoJourney.needsNewDemoSession(null), true);
assert.equal(demoJourney.needsNewDemoSession(market({ lifecycle: 'bettable' })), false);
assert.equal(
  demoJourney.canUserSettleDemoMarket({
    connected: true,
    controllerReady: true,
    hasPosition: false,
    market: market({ lifecycle: 'bettable' }),
  }),
  false,
  'demo settlement should stay locked until the connected user has a position',
);
assert.equal(
  demoJourney.canUserSettleDemoMarket({
    connected: true,
    controllerReady: true,
    hasPosition: true,
    market: market({ lifecycle: 'bettable' }),
  }),
  true,
  'demo settlement should unlock after the connected user has a position',
);
assert.equal(
  demoJourney.canUserSettleDemoMarket({
    connected: true,
    controllerReady: true,
    hasPosition: true,
    market: market({ lifecycle: 'resolved', resolved: true }),
  }),
  false,
  'resolved demo markets should not be settleable again',
);

{
  const account = '0xf75C00b432179483CF667af7C7eF53EFEe89ef31';
  const requests = [];
  const provider = {
    request: async (payload) => {
      requests.push(payload);
      if (payload.method === 'eth_sendTransaction') return '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1' };
      throw new Error(`unexpected method ${payload.method}`);
    },
  };

  await demoJourney.claimDemoTokens(provider, account);

  const tx = requests.find((request) => request.method === 'eth_sendTransaction');
  assert.equal(tx.params[0].from, account, 'demo claim transaction should include the connected account as from');
}

{
  const account = '0xf75C00b432179483CF667af7C7eF53EFEe89ef31';
  const requests = [];
  const provider = {
    request: async (payload) => {
      requests.push(payload);
      if (payload.method === 'eth_sendTransaction') return '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1' };
      throw new Error(`unexpected method ${payload.method}`);
    },
  };

  await demoJourney.startDemoSession(provider, account);

  const tx = requests.find((request) => request.method === 'eth_sendTransaction');
  assert.equal(tx.params[0].from, account, 'demo session transaction should include the connected account as from');
  assert.equal(tx.params[0].to.toLowerCase(), '0x67123f7d2a03dd64397287a14dc5ffa88a89376d');
  assert.equal(tx.params[0].data, '0x37d66a19');
}

{
  const account = '0xf75C00b432179483CF667af7C7eF53EFEe89ef31';
  const expected = '0x1234567890123456789012345678901234567890';
  const requests = [];
  const provider = {
    request: async (payload) => {
      requests.push(payload);
      return `0x${'0'.repeat(24)}${expected.slice(2).toLowerCase()}`;
    },
  };

  const address = await demoJourney.readUserDemoMarket(provider, account);

  assert.equal(address, expected.toLowerCase());
  assert.equal(requests[0].method, 'eth_call');
  assert.equal(requests[0].params[0].data.startsWith('0x95a449a2'), true);
}

{
  const account = '0xf75C00b432179483CF667af7C7eF53EFEe89ef31';
  const marketAddress = '0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c';
  const requests = [];
  const provider = {
    request: async (payload) => {
      requests.push(payload);
      if (payload.method === 'eth_sendTransaction') return '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1' };
      throw new Error(`unexpected method ${payload.method}`);
    },
  };

  await portfolioModule.claimMarket(provider, marketAddress, account);

  const tx = requests.find((request) => request.method === 'eth_sendTransaction');
  assert.equal(tx.params[0].from, account, 'claim transaction should include the connected account as from');
  assert.equal(tx.params[0].to, marketAddress);
  assert.equal(tx.params[0].data.startsWith('0x1e83409a'), true);
}

{
  const account = '0xf75C00b432179483CF667af7C7eF53EFEe89ef31';
  const oneToken = 10n ** 18n;
  const sentTransactions = [];
  const word = (value) => `0x${value.toString(16).padStart(64, '0')}`;
  const provider = {
    request: async (payload) => {
      if (payload.method === 'eth_call') {
        const data = String(payload.params[0].data);
        if (data.startsWith('0x70a08231')) return word(10n * oneToken);
        if (data.startsWith('0xdd62ed3e')) return word(0n);
        return word(0n);
      }
      if (payload.method === 'eth_sendTransaction') {
        sentTransactions.push(payload.params[0]);
        return '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      }
      if (payload.method === 'eth_getTransactionReceipt') return { status: '0x1', logs: [] };
      throw new Error(`unexpected method ${payload.method}`);
    },
  };

  await dapp.executeTrade(
    provider,
    account,
    {
      marketAddress: '0x2C26308701C809751B8C22B922531fdf47ED6211',
      yesTokenAddress: '0x677D7E3866Dcd24Baa63379bCDc1476d364Ee701',
      noTokenAddress: '0xBbB0ABCB7e7c127458CB0BFe828d61dA8661a03b',
    },
    'buy',
    'yes',
    oneToken,
    () => {},
  );

  assert.equal(sentTransactions.length, 3, 'buy should approve collateral, approve pool token, then submit router trade');
  assert.deepEqual(
    sentTransactions.map((tx) => tx.from),
    [account, account, account],
    'all user-side dapp transactions should include the connected account as from',
  );
}

assert.equal(marketAnalytics.isBettableMarket(market(), 1_000), true);
assert.equal(marketAnalytics.isBettableMarket(market({ paused: true }), 1_000), false);
assert.equal(marketAnalytics.isBettableMarket(market({ voided: true }), 1_000), false);
assert.equal(marketAnalytics.isBettableMarket(market({ resolved: true }), 1_000), false);
assert.equal(marketAnalytics.isBettableMarket(market({ deadline: 999n }), 1_000), false);
assert.equal(marketAnalytics.getMarketLifecycle(market({ paused: true }), 1_000), 'paused');
assert.equal(marketAnalytics.getMarketLifecycle(market({ voided: true }), 1_000), 'voided');
assert.equal(marketAnalytics.getMarketLifecycle(market({ resolved: true }), 1_000), 'resolved');
assert.equal(marketAnalytics.getMarketLifecycle(market({ deadline: 999n }), 1_000), 'expired');

const portfolio = portfolioAnalytics.analyzePortfolio([
  { market: market(), yesAmount: 2n, noAmount: 0n, claimable: 5n, claimed: false, costBasis: 1n },
  { market: market({ address: '0x0000000000000000000000000000000000000004' }), yesAmount: 0n, noAmount: 3n, claimable: 0n, claimed: false },
]);
assert.equal(portfolio.totalClaimable, 5n);
assert.equal(portfolio.marketsCount, 2);
assert.equal(portfolio.pnlKnown, false);

assert.equal(convictionAnalytics.estimateClaim(100n, 5n, 20n), 25n);
assert.equal(convictionAnalytics.estimateClaim(100n, 5n, 0n), 0n);
assert.equal(convictionAnalytics.formatBps(275), '2.75%');
assert.equal(convictionAnalytics.formatBps(undefined), 'Unavailable');

{
  const snapshot = convictionAnalytics.buildConvictionSnapshot({
    market: market(),
    mechanism: {
      yesExposure: 7n,
      noExposure: 3n,
      totalYesWeight: 14n,
      totalNoWeight: 3n,
      createdAt: 100n,
    },
    position: {
      market: market(),
      yesAmount: 2n,
      noAmount: 0n,
      yesWeight: 4n,
      noWeight: 0n,
      claimable: 0n,
      claimed: false,
    },
    now: 150,
  });

  assert.equal(snapshot.analyticsKnown, true);
  assert.equal(snapshot.yesConvictionWeight, 14n);
  assert.equal(snapshot.noConvictionWeight, 3n);
  assert.equal(snapshot.userConvictionWeight, 4n);
}

const item = evidence.activityToEvidence({
  txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  market: '0x0000000000000000000000000000000000000001',
  kind: 'enter',
  user: '0x0000000000000000000000000000000000000009',
  timestamp: 1,
});
assert.equal(item.kind, 'enter');
assert.equal(item.source, 'manual-wallet');
assert.equal(evidence.evidenceStatus({ ...item, hookObserved: true, poolManagerObserved: true, marketEventObserved: true }), 'Ready for judging');
assert.equal(evidence.evidenceStatus({ ...item, txHash: undefined }), 'Needs transaction hash');

{
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init.body));
    requests.push(body.method);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: body.method === 'eth_getLogs' ? [] : '0x1234' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = rpcClient.createJsonRpcClient('https://rpc.example', { minIntervalMs: 0, timeoutMs: 1000 });
  assert.equal(await client.ethCall('0x0000000000000000000000000000000000000001', '0xabcdef'), '0x1234');
  assert.deepEqual(await client.ethGetLogs({ address: '0x0000000000000000000000000000000000000001', topics: [] }), []);
  assert.deepEqual(requests, ['eth_call', 'eth_getLogs']);
}

{
  let starts = 0;
  globalThis.fetch = async (_url, init) => {
    starts += 1;
    const signal = init.signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  };

  const client = rpcClient.createJsonRpcClient('https://rpc.example', { minIntervalMs: 0, timeoutMs: 100 });
  const pending = [
    client.ethCall('0x0000000000000000000000000000000000000001', '0x01').catch((error) => error),
    client.ethCall('0x0000000000000000000000000000000000000001', '0x02').catch((error) => error),
    client.ethCall('0x0000000000000000000000000000000000000001', '0x03').catch((error) => error),
  ];

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(starts, 3, 'hung RPC calls should not block subsequent market field reads');
  await Promise.allSettled(pending);
}

{
  const startedAt = Date.now();
  await assert.rejects(
    asyncGuards.withTimeout(new Promise(() => {}), 25, 'market load timeout'),
    /market load timeout/,
  );
  assert.ok(Date.now() - startedAt < 500, 'withTimeout should reject without waiting for a hung promise');
  assert.equal(await asyncGuards.withTimeout(Promise.resolve('ok'), 500, 'should not timeout'), 'ok');
}

{
  const probabilityLog = {
    address: '0x0000000000000000000000000000000000000001',
    blockNumber: '0x10',
    transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    transactionIndex: '0x0',
    blockHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    logIndex: '0x1',
    removed: false,
    topics: [
      marketEvents.MARKET_EVENT_TOPICS.probabilityUpdated,
      `0x${'11'.repeat(32)}`,
    ],
    data: marketEvents.encodeTestWords([620000000000000000n, 380000000000000000n]),
  };

  const decoded = marketEvents.decodeMarketLog(probabilityLog);
  assert.equal(decoded.kind, 'probability');
  assert.equal(decoded.yesProbability, 620000000000000000n);
  assert.equal(decoded.noProbability, 380000000000000000n);
  assert.deepEqual(marketEvents.toOutcomeCurvePoints([decoded]).map((point) => point.yes), [62]);
}

{
  const proof = marketProof.buildHookPathProof({
    routerConfigured: true,
    poolManagerAddress: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
    hookAddress: '0x7cda90700b2b2957c73d3fd3afa0ba9f47e514c0',
    market: '0x0000000000000000000000000000000000000001',
    receipts: [{
      transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      logs: [
        { address: '0x360e68faccca8ca495c1b759fd9eee466db9fb32', topics: [marketProof.PROOF_TOPICS.poolManagerSwap] },
        { address: '0x7cda90700b2b2957c73d3fd3afa0ba9f47e514c0', topics: [marketProof.PROOF_TOPICS.hookSwapObserved] },
        { address: '0x0000000000000000000000000000000000000001', topics: [marketEvents.MARKET_EVENT_TOPICS.convictionEntered] },
      ],
    }],
  });

  assert.equal(proof.poolManager.status, 'observed');
  assert.equal(proof.hook.status, 'observed');
  assert.equal(proof.market.status, 'observed');
}

{
  const ready = tradeReadiness.getTradeReadiness({
    connected: true,
    market: market({ lifecycle: 'bettable' }),
    amount: 100n,
    balances: { collateral: 200n, pool0: 10n ** 18n, pool1: 10n ** 18n, yes: 0n, no: 0n },
    mode: 'buy',
    outcome: 'yes',
  });
  assert.equal(ready.ready, true);

  const expired = tradeReadiness.getTradeReadiness({
    connected: true,
    market: market({ lifecycle: 'expired' }),
    amount: 100n,
    balances: { collateral: 200n, pool0: 10n ** 18n, pool1: 10n ** 18n, yes: 0n, no: 0n },
    mode: 'buy',
    outcome: 'yes',
  });
  assert.equal(expired.ready, false);
  assert.equal(expired.reasons[0].code, 'MARKET_NOT_BETTABLE');
}

console.log('unit tests passed');
