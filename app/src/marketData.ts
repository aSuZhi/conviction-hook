import { config } from './config';
import { getMarketLifecycle, type MarketLifecycle } from './marketAnalytics';
import { createJsonRpcClient } from './rpcClient';

export type MarketStatus = 'active' | 'expired' | 'resolved';

export type MarketSummary = {
  address: `0x${string}`;
  question: string;
  deadline: bigint;
  yesProbability: bigint;
  noProbability: bigint;
  collateralPool: bigint;
  resolved: boolean;
  paused: boolean;
  voided: boolean;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
  resolutionEvidenceURI?: string;
  voidEvidenceURI?: string;
  lifecycle: MarketLifecycle;
  status: MarketStatus;
};

const MAX_MARKETS = 100;
const WORD_HEX_LENGTH = 64;
const ADDRESS_HIGH_BYTES_HEX_LENGTH = 24;
const MAX_SAFE_BYTE_LENGTH = BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 2));
const rpc = config.rpcUrl ? createJsonRpcClient(config.rpcUrl) : null;

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
} as const;

export async function loadMarkets(): Promise<MarketSummary[]> {
  if (!config.rpcUrl) return [];

  const marketAddresses: `0x${string}`[] = [];
  const factoryAddress = config.factoryAddress;

  if (factoryAddress) {
    const marketsLength = await ethCall(factoryAddress, selectors.marketsLength).then(decodeUint256);
    const marketsToLoad = Number(marketsLength > BigInt(MAX_MARKETS) ? BigInt(MAX_MARKETS) : marketsLength);
    const marketAddressResults = await Promise.allSettled(
      Array.from({ length: marketsToLoad }, (_, index) =>
        ethCall(factoryAddress, encodeMarketsCall(BigInt(index))).then(decodeAddress),
      ),
    );

    for (const result of marketAddressResults) {
      if (result.status === 'fulfilled') marketAddresses.push(result.value);
    }
  }

  if (marketAddresses.length === 0 && config.marketAddress) {
    marketAddresses.push(config.marketAddress);
  }

  const uniqueMarketAddresses = dedupeAddresses(marketAddresses);
  const marketResults = await Promise.allSettled(uniqueMarketAddresses.map((address) => loadMarket(address)));
  const markets: MarketSummary[] = [];

  for (const result of marketResults) {
    if (result.status === 'fulfilled') markets.push(result.value);
  }

  return markets.sort((left, right) => compareBigInts(left.deadline, right.deadline));
}

export async function loadMarket(address: `0x${string}`): Promise<MarketSummary> {
  if (!config.rpcUrl) throw new Error('RPC URL is not configured');

  const [question, deadline, probabilities, collateralPool, resolved, yesToken, noToken] = await Promise.all([
    ethCall(address, selectors.question).then(decodeString),
    ethCall(address, selectors.deadline).then(decodeUint256),
    ethCall(address, selectors.probabilities).then(decodeUint256Pair),
    ethCall(address, selectors.collateralPool).then(decodeUint256),
    ethCall(address, selectors.resolved).then(decodeBool),
    ethCall(address, selectors.yesToken).then(decodeAddress),
    ethCall(address, selectors.noToken).then(decodeAddress),
  ]);
  const [paused, voided, resolutionEvidenceURI, voidEvidenceURI] = await Promise.all([
    ethCallOptional(address, selectors.paused).then((hex) => (hex ? decodeBool(hex) : false)),
    ethCallOptional(address, selectors.voided).then((hex) => (hex ? decodeBool(hex) : false)),
    ethCallOptional(address, selectors.resolutionEvidenceURI).then((hex) => (hex ? decodeString(hex) : undefined)),
    ethCallOptional(address, selectors.voidEvidenceURI).then((hex) => (hex ? decodeString(hex) : undefined)),
  ]);
  const lifecycle = getMarketLifecycle({ address, question, deadline, collateralPool, resolved, paused, voided });

  return {
    address,
    question,
    deadline,
    yesProbability: probabilities[0],
    noProbability: probabilities[1],
    collateralPool,
    resolved,
    paused,
    voided,
    yesToken,
    noToken,
    resolutionEvidenceURI,
    voidEvidenceURI,
    lifecycle,
    status: getMarketStatus(lifecycle),
  };
}

async function ethCall(to: `0x${string}`, data: string) {
  if (!rpc) throw new Error('RPC URL is not configured');
  const context = formatCallContext(to, data);

  try {
    const result = await rpc.ethCall(to, data);
    if (typeof result !== 'string') throw new Error('missing or non-string result');
    return result;
  } catch (error) {
    throw new Error(`RPC call failed (${context}): ${getErrorMessage(error)}`);
  }
}

async function ethCallOptional(to: `0x${string}`, data: string) {
  try {
    const result = await ethCall(to, data);
    return result === '0x' ? undefined : result;
  } catch {
    return undefined;
  }
}

function encodeMarketsCall(index: bigint) {
  return `${selectors.markets}${index.toString(16).padStart(WORD_HEX_LENGTH, '0')}`;
}

function decodeUint256(hex: string) {
  return decodeWordAsUint256(hex, 0, 'uint256');
}

function decodeUint256Pair(hex: string) {
  return [decodeWordAsUint256(hex, 0, 'uint256 pair'), decodeWordAsUint256(hex, 1, 'uint256 pair')] as const;
}

function decodeBool(hex: string) {
  const value = decodeWordAsUint256(hex, 0, 'bool');
  if (value === 0n) return false;
  if (value === 1n) return true;
  throw new Error('Invalid bool response: value must be 0 or 1');
}

function decodeAddress(hex: string): `0x${string}` {
  const word = readWord(hex, 0, 'address');
  const highBytes = word.slice(0, ADDRESS_HIGH_BYTES_HEX_LENGTH);

  if (!/^0+$/.test(highBytes)) {
    throw new Error('Invalid address response: high 12 bytes must be zero');
  }

  return `0x${word.slice(ADDRESS_HIGH_BYTES_HEX_LENGTH)}` as `0x${string}`;
}

function decodeString(hex: string) {
  const body = validateHexResponse(hex, 'string');

  if (body.length < WORD_HEX_LENGTH) {
    throw new Error('Invalid string response: missing offset word');
  }

  const offset = BigInt(`0x${body.slice(0, WORD_HEX_LENGTH)}`);
  if (offset < 32n) throw new Error('Invalid string response: offset must point past the head word');
  if (offset % 32n !== 0n) throw new Error('Invalid string response: offset must be 32-byte aligned');

  const lengthStart = byteLengthToHexLength(offset, 'string offset');
  const lengthEnd = lengthStart + WORD_HEX_LENGTH;

  if (body.length < lengthEnd) {
    throw new Error('Invalid string response: missing length word');
  }

  const length = BigInt(`0x${body.slice(lengthStart, lengthEnd)}`);
  const dataStart = lengthEnd;
  const bytesEnd = dataStart + byteLengthToHexLength(length, 'string length');
  const paddedLength = ((length + 31n) / 32n) * 32n;
  const dataEnd = dataStart + byteLengthToHexLength(paddedLength, 'string padded length');

  if (body.length < dataEnd) {
    throw new Error('Invalid string response: data is shorter than declared length');
  }

  const bytes = body.slice(dataStart, bytesEnd);
  const chars = bytes.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [];

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(chars));
  } catch (error) {
    throw new Error(`Invalid string response: ${getErrorMessage(error)}`);
  }
}

function decodeWordAsUint256(hex: string, wordIndex: number, label: string) {
  return BigInt(`0x${readWord(hex, wordIndex, label)}`);
}

function readWord(hex: string, wordIndex: number, label: string) {
  const body = validateHexResponse(hex, label);
  const wordStart = wordIndex * WORD_HEX_LENGTH;
  const wordEnd = wordStart + WORD_HEX_LENGTH;

  if (body.length < wordEnd) {
    throw new Error(`Invalid ${label} response: missing 32-byte word ${wordIndex + 1}`);
  }

  return body.slice(wordStart, wordEnd);
}

function validateHexResponse(hex: string, label: string) {
  if (!hex.startsWith('0x')) throw new Error(`Invalid ${label} response: must start with 0x`);

  const body = hex.slice(2);
  if (body.length % 2 !== 0) throw new Error(`Invalid ${label} response: hex byte length must be even`);
  if (!/^[0-9a-fA-F]*$/.test(body)) throw new Error(`Invalid ${label} response: contains non-hex characters`);

  return body;
}

function byteLengthToHexLength(byteLength: bigint, label: string) {
  if (byteLength > MAX_SAFE_BYTE_LENGTH) throw new Error(`Invalid ${label}: too large to decode safely`);
  return Number(byteLength) * 2;
}

function formatCallContext(to: `0x${string}`, data: string) {
  return `target=${to} data=${data}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function dedupeAddresses(addresses: `0x${string}`[]) {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareBigInts(left: bigint, right: bigint) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getMarketStatus(lifecycle: MarketLifecycle): MarketStatus {
  if (lifecycle === 'resolved') return 'resolved';
  if (lifecycle === 'expired') return 'expired';
  return 'active';
}
