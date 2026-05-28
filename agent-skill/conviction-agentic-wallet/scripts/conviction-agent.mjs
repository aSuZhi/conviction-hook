#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawConfig = JSON.parse(readFileSync(path.join(__dirname, '..', 'addresses.json'), 'utf8'));
const config = {
  ...rawConfig,
  rpcUrl: process.env.CONVICTION_AGENT_RPC_URL || rawConfig.rpcUrl,
};

const SELECTORS = {
  approve: '0x095ea7b3',
  startSession: '0x37d66a19',
  claimDemo: '0x498da513',
  settle: '0x4b44db41',
  claimWinnings: '0x1e83409a',
  enter: '0x9d1a3a27',
  exit: '0xd1b72e2f',
};

const TOPICS = {
  poolManagerSwap: '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f',
  hookSwapObserved: '0x9dff64abf697a4ba63fad8c5860123e8f64ec30c10898047e7db9ff48cde9b43',
  convictionEntered: '0x353322d2c146d65e2ee3124ef29d1d2b3f9669b15efe89fdf0d538f6ddb19d01',
  convictionExited: '0xba77dfa256c3d657072ebc904d7f3d2e9b21ed8453447dc2b45a315eefcbcf8f',
  marketEarlyResolved: '0x4b09950b464887b99f2f8c5429bd2f8934793383fa41e08f6464c0d9d8724f96',
  marketResolved: '0xacfe72f3cde40efc742b804309080aaca0b42008ab07b7522220a33ebb38095d',
  claimed: '0x7c6b338bd1a762ed17afe6b41e0f3ce0fb9da7c63e05eb1abbba460cec24c148',
};

const MIN_SQRT_PRICE_PLUS_ONE = 4_295_128_740n;
const MAX_SQRT_PRICE_MINUS_ONE = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341n;
const POOL_SWAP_AMOUNT = 100n;
const ZERO_WORD = '0'.repeat(64);

async function main() {
  const [command, ...tail] = process.argv.slice(2);

  if (!command || command === 'help' || tail.includes('--help')) return printHelp();
  if (command === 'config') return printJson(config);
  if (command === 'build') {
    const [action, ...rest] = tail;
    return printJson(buildPayload(action, parseFlags(rest)));
  }
  if (command === 'inspect-tx') return printJson(await inspectTx(parseFlags(tail)));

  fail(`Unknown command: ${command}`);
}

function buildPayload(action, flags) {
  const from = requireAddress(flags.from, '--from');
  if (action === 'start-session') return tx(from, config.controller, SELECTORS.startSession, 'startDemoSession()');
  if (action === 'claim-demo') return tx(from, config.controller, SELECTORS.claimDemo, 'claimDemoTokens()');

  if (action === 'settle') {
    const outcome = requireOutcome(flags.outcome);
    const evidence = String(flags.evidence ?? `demo://agent-${outcome}-${Date.now()}`);
    return tx(from, config.controller, encodeSettle(outcome, evidence), `settleDemoMarket(${outcome})`);
  }

  if (action === 'claim-winnings') {
    const market = requireAddress(flags.market, '--market');
    const account = requireAddress(flags.account ?? from, '--account');
    return tx(from, market, SELECTORS.claimWinnings + encodeAddress(account), 'claim(address)');
  }

  if (action === 'approve-collateral') {
    const spender = requireAddress(flags.spender ?? config.router, '--spender');
    const amount = parseTokenAmount(requireValue(flags.amount, '--amount'));
    return tx(from, config.collateral, SELECTORS.approve + encodeAddress(spender) + encodeUint(amount), 'approve collateral exact amount');
  }

  if (action === 'approve-pool0' || action === 'approve-pool1') {
    const spender = requireAddress(flags.spender ?? config.router, '--spender');
    const token = action === 'approve-pool0' ? config.poolCurrency0 : config.poolCurrency1;
    return tx(from, token, SELECTORS.approve + encodeAddress(spender) + encodeUint(POOL_SWAP_AMOUNT), `${action} exact swap token`);
  }

  if (action === 'enter' || action === 'exit') {
    const market = requireAddress(flags.market, '--market');
    const outcome = requireOutcome(flags.outcome);
    const amount = parseTokenAmount(requireValue(flags.amount, '--amount'));
    const selector = action === 'enter' ? SELECTORS.enter : SELECTORS.exit;
    const data = selector + encodeRouterArgs({
      market,
      outcome,
      amount,
      zeroForOne: action === 'enter',
      sqrtPriceLimitX96: action === 'enter' ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE,
    });
    return tx(from, config.router, data, `${action} ${outcome} through ConvictionRouter`);
  }

  fail(`Unknown build action: ${action}`);
}

async function inspectTx(flags) {
  const hash = requireHex(flags.hash, '--hash', 66);
  const market = flags.market ? requireAddress(flags.market, '--market') : undefined;
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  if (!receipt) return { hash, status: 'pending' };
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const hasTopic = (topic) => logs.some((log) => String(log.topics?.[0] ?? '').toLowerCase() === topic.toLowerCase());
  const hasAddress = (address) => logs.some((log) => String(log.address ?? '').toLowerCase() === address.toLowerCase());
  const marketTopics = [TOPICS.convictionEntered, TOPICS.convictionExited, TOPICS.marketEarlyResolved, TOPICS.marketResolved, TOPICS.claimed];

  return {
    hash,
    status: receipt.status === '0x1' ? 'success' : receipt.status === '0x0' ? 'reverted' : receipt.status,
    blockNumber: receipt.blockNumber,
    poolManagerObserved: hasTopic(TOPICS.poolManagerSwap) || hasAddress(config.poolManager),
    hookObserved: hasTopic(TOPICS.hookSwapObserved) || hasAddress(config.hook),
    marketEventObserved: marketTopics.some(hasTopic) || (market ? hasAddress(market) : false),
    explorer: `${config.explorerTxUrl}${hash}`,
  };
}

async function rpc(method, params) {
  const response = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const payload = await response.json();
  if (payload.error) fail(`${payload.error.code}: ${payload.error.message}`);
  return payload.result;
}

function tx(from, to, data, label) {
  return {
    label,
    network: config.chainName,
    chainId: config.chainId,
    transaction: { from, to, data, value: '0x0' },
    safety: 'Review in wallet. Exact approvals only. Do not bypass confirmation.',
  };
}

function encodeSettle(outcome, evidence) {
  return SELECTORS.settle + encodeUint(outcome === 'yes' ? 1n : 2n) + encodeUint(64n) + encodeStringBody(evidence);
}

function encodeRouterArgs({ market, outcome, amount, zeroForOne, sqrtPriceLimitX96 }) {
  return [
    encodeAddress(config.poolCurrency0),
    encodeAddress(config.poolCurrency1),
    encodeUint(BigInt(config.poolFee)),
    encodeInt(BigInt(config.poolTickSpacing)),
    encodeAddress(config.hook),
    encodeBool(zeroForOne),
    encodeInt(-POOL_SWAP_AMOUNT),
    encodeUint(sqrtPriceLimitX96),
    encodeAddress(market),
    encodeUint(outcome === 'yes' ? 1n : 2n),
    encodeUint(amount),
  ].join('');
}

function parseTokenAmount(value) {
  const trimmed = String(value).trim();
  if (!/^\d+(\.\d{0,18})?$/.test(trimmed)) fail(`Invalid decimal amount: ${value}`);
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
}

function encodeStringBody(value) {
  const bytes = new TextEncoder().encode(value);
  const data = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return encodeUint(BigInt(bytes.length)) + data.padEnd(Math.ceil(data.length / 64) * 64, '0');
}

function encodeAddress(address) {
  return ZERO_WORD.slice(0, 24) + strip0x(address).toLowerCase();
}

function encodeUint(value) {
  if (value < 0n) fail('Negative uint is invalid');
  return value.toString(16).padStart(64, '0');
}

function encodeInt(value) {
  return value >= 0n ? encodeUint(value) : (2n ** 256n + value).toString(16).padStart(64, '0');
}

function encodeBool(value) {
  return encodeUint(value ? 1n : 0n);
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) fail(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

function requireOutcome(value) {
  if (value === 'yes' || value === 'no') return value;
  fail('--outcome must be yes or no');
}

function requireAddress(value, label) {
  if (typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)) return value;
  fail(`${label} must be an EVM address`);
}

function requireHex(value, label, length) {
  if (typeof value === 'string' && value.startsWith('0x') && /^[0-9a-fA-F]+$/.test(value.slice(2)) && (!length || value.length === length)) return value;
  fail(`${label} must be a ${length ? `${length}-char ` : ''}hex value`);
}

function requireValue(value, label) {
  if (value !== undefined && value !== true) return value;
  fail(`${label} is required`);
}

function strip0x(value) {
  return String(value).startsWith('0x') ? String(value).slice(2) : String(value);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`Conviction Agent helper

Commands:
  config
  build start-session --from 0x...
  build claim-demo --from 0x...
  build enter --from 0x... --market 0x... --outcome yes|no --amount 0.5
  build exit --from 0x... --market 0x... --outcome yes|no --amount 0.5
  build settle --from 0x... --outcome yes|no --evidence demo://...
  build claim-winnings --from 0x... --market 0x... --account 0x...
  inspect-tx --hash 0x... --market 0x...
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
