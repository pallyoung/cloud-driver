import { PropsWithChildren } from 'react';
import { RelaxProvider } from '../state/relax';

export function AppProviders({ children }: PropsWithChildren) {
  return <RelaxProvider>{children}</RelaxProvider>;
}
