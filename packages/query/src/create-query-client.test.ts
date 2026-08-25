import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from './create-query-client';

describe('createQueryClient', () => {
  it('creates isolated clients with independent defaults and caches', () => {
    const first = createQueryClient({
      defaultOptions: { queries: { staleTime: 1_000 } },
    });
    const second = createQueryClient({
      defaultOptions: { queries: { staleTime: 5_000 } },
    });

    first.setQueryData(['identity'], 'first');

    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries?.staleTime).toBe(1_000);
    expect(second.getDefaultOptions().queries?.staleTime).toBe(5_000);
    expect(second.getQueryData(['identity'])).toBeUndefined();
  });

  it('forwards query failures to the configured cache callback', async () => {
    const error = new Error('query failed');
    const onQueryError = vi.fn();
    const client = createQueryClient({ onQueryError });

    await expect(
      client.query({
        queryFn: () => Promise.reject(error),
        queryKey: ['failing-query'],
        retry: false,
      }),
    ).rejects.toBe(error);

    expect(onQueryError).toHaveBeenCalledOnce();
    expect(onQueryError.mock.calls[0]?.[0]).toBe(error);
  });

  it('forwards mutation failures to the configured cache callback', async () => {
    const error = new Error('mutation failed');
    const onMutationError = vi.fn();
    const client = createQueryClient({ onMutationError });
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(error),
      mutationKey: ['failing-mutation'],
    });

    await expect(mutation.execute(undefined)).rejects.toBe(error);

    expect(onMutationError).toHaveBeenCalledOnce();
    expect(onMutationError.mock.calls[0]?.[0]).toBe(error);
  });
});
