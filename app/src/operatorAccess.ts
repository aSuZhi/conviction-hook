import { config } from './config';

export type OperationAccess = {
  allowed: boolean;
  verified: boolean;
  reason: string;
};

export function managerAccess(account?: `0x${string}` | null): OperationAccess {
  if (!account) {
    return { allowed: false, verified: true, reason: 'Connect the owner or manager wallet to submit Studio operations.' };
  }
  if (!config.managerAddress) {
    return {
      allowed: true,
      verified: false,
      reason: 'Manager address is not configured in the frontend; the contract will enforce owner or manager permission.',
    };
  }
  if (!sameAddress(account, config.managerAddress)) {
    return {
      allowed: false,
      verified: true,
      reason: 'Connected account is not the configured manager. Studio actions are read-only for this wallet.',
    };
  }
  return { allowed: true, verified: true, reason: 'Connected account matches the configured manager.' };
}

export function resolverAccess(account?: `0x${string}` | null): OperationAccess {
  if (!account) {
    return { allowed: false, verified: true, reason: 'Connect the resolver wallet to resolve a market.' };
  }
  if (!config.resolverAddress) {
    return {
      allowed: true,
      verified: false,
      reason: 'Resolver address is not configured in the frontend; the contract will enforce resolver permission.',
    };
  }
  if (!sameAddress(account, config.resolverAddress)) {
    return {
      allowed: false,
      verified: true,
      reason: 'Connected account is not the configured resolver. Resolve actions are disabled.',
    };
  }
  return { allowed: true, verified: true, reason: 'Connected account matches the configured resolver.' };
}

function sameAddress(left: `0x${string}`, right: `0x${string}`) {
  return left.toLowerCase() === right.toLowerCase();
}
