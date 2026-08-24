export {
  HydrationBoundary,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useIsFetching,
  useIsMutating,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';

export type {
  DefaultOptions,
  DehydratedState,
  InfiniteData,
  QueryFunctionContext,
  QueryKey,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseQueryOptions,
  UseSuspenseQueryResult,
} from '@tanstack/react-query';

export { createQueryClient } from './create-query-client';
export type {
  CreateQueryClientOptions,
  MutationErrorHandler,
  QueryErrorHandler,
} from './create-query-client';
export { QueryProvider } from './QueryProvider';
export type { QueryProviderProps } from './QueryProvider';
