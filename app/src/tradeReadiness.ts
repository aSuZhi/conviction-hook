import { POOL_SWAP_AMOUNT, type Balances, type Outcome, type TradeMode } from './dapp';
import type { MarketSummary } from './marketData';

export type ReadinessReasonCode =
  | 'WALLET_NOT_CONNECTED'
  | 'MARKET_NOT_BETTABLE'
  | 'INVALID_AMOUNT'
  | 'BALANCES_LOADING'
  | 'INSUFFICIENT_COLLATERAL'
  | 'INSUFFICIENT_OUTCOME'
  | 'POOL_TOKEN_MISSING';

export type ReadinessReason = {
  code: ReadinessReasonCode;
  label: string;
};

export function getTradeReadiness(input: {
  connected: boolean;
  market?: MarketSummary;
  amount: bigint;
  balances?: Balances | null;
  mode: TradeMode;
  outcome: Outcome;
}) {
  const reasons: ReadinessReason[] = [];

  if (!input.connected) reasons.push({ code: 'WALLET_NOT_CONNECTED', label: 'Connect wallet' });
  if (!input.market || input.market.lifecycle !== 'bettable') {
    reasons.push({ code: 'MARKET_NOT_BETTABLE', label: 'Market is not open for trading' });
  }
  if (input.amount <= 0n) reasons.push({ code: 'INVALID_AMOUNT', label: 'Enter a positive amount' });
  if (input.connected && !input.balances) reasons.push({ code: 'BALANCES_LOADING', label: 'Reading wallet balances' });

  if (input.balances && input.mode === 'buy' && input.balances.collateral < input.amount) {
    reasons.push({ code: 'INSUFFICIENT_COLLATERAL', label: 'Insufficient cUSDC' });
  }

  if (input.balances && input.mode === 'sell') {
    const outcomeBalance = input.outcome === 'yes' ? input.balances.yes : input.balances.no;
    if (outcomeBalance < input.amount) reasons.push({ code: 'INSUFFICIENT_OUTCOME', label: 'Insufficient outcome tokens' });
  }

  if (input.balances && input.balances.pool0 < POOL_SWAP_AMOUNT && input.balances.pool1 < POOL_SWAP_AMOUNT) {
    reasons.push({ code: 'POOL_TOKEN_MISSING', label: `Need at least ${POOL_SWAP_AMOUNT.toString()} units of either pool token` });
  }

  return { ready: reasons.length === 0, reasons };
}
