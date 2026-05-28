import type { ReactNode } from 'react';

export function UserDappShell({ children }: { children: ReactNode }) {
  return <section className="user-dapp-shell">{children}</section>;
}
