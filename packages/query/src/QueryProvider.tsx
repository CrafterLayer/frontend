import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

export type QueryProviderProps = PropsWithChildren<{
  client: QueryClient;
}>;

export function QueryProvider({ children, client }: QueryProviderProps) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
