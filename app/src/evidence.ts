import type { ActivityItem } from './components/ActivityFeed';

export type EvidenceKind =
  | 'deploy'
  | 'create-market'
  | 'enter'
  | 'exit'
  | 'freeze-rejected-swap'
  | 'resolve'
  | 'claim'
  | 'agent-wallet'
  | 'hook-event';

export type EvidenceSource = 'manual-wallet' | 'agentic-wallet' | 'script' | 'indexer' | 'deployment';

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  label: string;
  market?: `0x${string}`;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
  actor?: `0x${string}`;
  source: EvidenceSource;
  hookObserved?: boolean;
  poolManagerObserved?: boolean;
  marketEventObserved?: boolean;
  timestamp?: number;
};

export function activityToEvidence(item: ActivityItem): EvidenceItem {
  return {
    id: item.txHash,
    kind: item.kind,
    label: labelForEvidenceKind(item.kind),
    market: item.market,
    txHash: item.txHash,
    actor: item.user,
    source: 'manual-wallet',
    hookObserved: item.kind === 'enter' || item.kind === 'exit',
    poolManagerObserved: item.kind === 'enter' || item.kind === 'exit',
    marketEventObserved: true,
    timestamp: item.timestamp,
  };
}

export function evidenceStatus(item: EvidenceItem) {
  if (!item.txHash && item.kind !== 'deploy') return 'Needs transaction hash';
  if (item.source !== 'deployment' && !item.hookObserved && (item.kind === 'enter' || item.kind === 'exit')) {
    return 'Needs Hook event proof';
  }
  if (item.hookObserved && item.poolManagerObserved && item.marketEventObserved) return 'Ready for judging';
  if (item.source === 'deployment' || item.txHash) return 'Mainnet evidence';
  return 'Local-only evidence';
}

export function labelForEvidenceKind(kind: EvidenceKind) {
  const labels: Record<EvidenceKind, string> = {
    deploy: 'Deploy',
    'create-market': 'Create market',
    enter: 'Enter',
    exit: 'Exit',
    'freeze-rejected-swap': 'Freeze rejection',
    resolve: 'Resolve',
    claim: 'Claim',
    'agent-wallet': 'Agentic Wallet',
    'hook-event': 'Hook event',
  };
  return labels[kind];
}

export function loadImportedAgentEvidence(): EvidenceItem[] {
  try {
    const raw = localStorage.getItem('conviction-agent-evidence');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvidenceItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImportedAgentEvidence(items: EvidenceItem[]) {
  localStorage.setItem('conviction-agent-evidence', JSON.stringify(items));
}
