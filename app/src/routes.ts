export type AppRoute =
  | { kind: 'markets' }
  | { kind: 'marketDetail'; marketAddress: `0x${string}`; outcome?: 'yes' | 'no' }
  | { kind: 'portfolio' }
  | { kind: 'wallet' }
  | { kind: 'activity' }
  | { kind: 'help' }
  | { kind: 'risk' }
  | { kind: 'demo' }
  | { kind: 'judge' }
  | { kind: 'agent' }
  | { kind: 'studioDashboard' }
  | { kind: 'studioMarkets' }
  | { kind: 'studioCreate' }
  | { kind: 'studioMarketOperations'; marketAddress: `0x${string}` };

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function parseRoute(pathname = currentPathname(), search = currentSearch()): AppRoute {
  const path = normalizePath(pathname);
  const parts = path.split('/').filter(Boolean);
  const outcome = parseOutcome(search);

  if (parts[0] === 'markets' && parts[1] && isAddress(parts[1])) {
    return { kind: 'marketDetail', marketAddress: parts[1] as `0x${string}`, outcome };
  }
  if (parts[0] === 'portfolio') return { kind: 'portfolio' };
  if (parts[0] === 'wallet') return { kind: 'wallet' };
  if (parts[0] === 'activity') return { kind: 'activity' };
  if (parts[0] === 'help') return { kind: 'help' };
  if (parts[0] === 'risk') return { kind: 'risk' };
  if (parts[0] === 'demo' || parts[0] === 'judge') return { kind: 'demo' };
  if (parts[0] === 'agent') return { kind: 'agent' };
  if (parts[0] === 'studio' && parts[1] === 'markets' && parts[2] && isAddress(parts[2])) {
    return { kind: 'studioMarketOperations', marketAddress: parts[2] as `0x${string}` };
  }
  if (parts[0] === 'studio' && parts[1] === 'markets') return { kind: 'studioMarkets' };
  if (parts[0] === 'studio' && parts[1] === 'create') return { kind: 'studioCreate' };
  if (parts[0] === 'studio') return { kind: 'studioDashboard' };
  return { kind: 'markets' };
}

export function routeToPath(route: AppRoute) {
  switch (route.kind) {
    case 'marketDetail':
      return `/markets/${route.marketAddress}${route.outcome ? `?outcome=${route.outcome}` : ''}`;
    case 'portfolio':
      return '/portfolio';
    case 'wallet':
      return '/wallet';
    case 'activity':
      return '/activity';
    case 'help':
      return '/help';
    case 'risk':
      return '/risk';
    case 'demo':
      return '/demo';
    case 'judge':
      return '/judge';
    case 'agent':
      return '/agent';
    case 'studioDashboard':
      return '/studio';
    case 'studioMarkets':
      return '/studio/markets';
    case 'studioCreate':
      return '/studio/create';
    case 'studioMarketOperations':
      return `/studio/markets/${route.marketAddress}`;
    default:
      return '/markets';
  }
}

export function isStudioRoute(route: AppRoute) {
  return route.kind.startsWith('studio');
}

export function isAddress(value: string): value is `0x${string}` {
  return ADDRESS_PATTERN.test(value);
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/markets';
  return pathname.replace(/\/+$/, '') || '/markets';
}

function currentPathname() {
  return typeof window === 'undefined' ? '/markets' : window.location.pathname;
}

function currentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

function parseOutcome(search: string) {
  const value = new URLSearchParams(search).get('outcome');
  return value === 'yes' || value === 'no' ? value : undefined;
}
