# `@craftkit/query`

Private TanStack Query foundation for CraftKit applications. It provides a curated public API plus
an explicit client factory/provider without UI, transport, or product coupling.

## Browser application

Create one client at the application bootstrap boundary and pass it explicitly:

```tsx
import { QueryProvider, createQueryClient } from '@craftkit/query';

const queryClient = createQueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
  onQueryError(error, query) {
    reportQueryFailure(error, query.queryKey);
  },
});

root.render(
  <QueryProvider client={queryClient}>
    <App />
  </QueryProvider>,
);
```

The bootstrap owns the client lifetime. The package intentionally exports no singleton.

## Server rendering

Create a fresh client for every server request and discard it after dehydration. Never place a
server QueryClient at module scope: that would share cache and request data across users. A browser
client may be retained for that browser application root after hydration.

## Ownership

- This package owns QueryClient construction, cache callbacks, provider wiring, and the supported
  TanStack Query public surface.
- Applications own query keys, API adapters, query/mutation hooks, retry policy, telemetry,
  notifications, persistence, and hydration lifecycle.
- `@craftkit/ui` and product packages must not be imported here.

## Verification

```bash
pnpm --filter @craftkit/query lint
pnpm --filter @craftkit/query typecheck
pnpm --filter @craftkit/query test:coverage
pnpm --filter @craftkit/query build
pnpm --filter @craftkit/query check:size
```
