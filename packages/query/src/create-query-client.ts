import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query';

type QueryCacheOptions = NonNullable<ConstructorParameters<typeof QueryCache>[0]>;
type MutationCacheOptions = NonNullable<ConstructorParameters<typeof MutationCache>[0]>;

export type QueryErrorHandler = NonNullable<QueryCacheOptions['onError']>;
export type MutationErrorHandler = NonNullable<MutationCacheOptions['onError']>;

export interface CreateQueryClientOptions {
  defaultOptions?: DefaultOptions;
  onMutationError?: MutationErrorHandler;
  onQueryError?: QueryErrorHandler;
}

export function createQueryClient({
  defaultOptions,
  onMutationError,
  onQueryError,
}: CreateQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    ...(defaultOptions ? { defaultOptions } : {}),
    mutationCache: new MutationCache(onMutationError ? { onError: onMutationError } : {}),
    queryCache: new QueryCache(onQueryError ? { onError: onQueryError } : {}),
  });
}
