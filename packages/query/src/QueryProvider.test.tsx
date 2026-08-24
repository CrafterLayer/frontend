import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from './create-query-client';
import { QueryProvider } from './QueryProvider';

type ClientProbeProps = {
  expected: QueryClient;
  label: string;
};

function ClientProbe({ expected, label }: ClientProbeProps) {
  const client = useQueryClient();

  return <output>{client === expected ? label : 'unexpected client'}</output>;
}

describe('QueryProvider', () => {
  it('uses exactly the caller-owned client', () => {
    const client = createQueryClient();

    render(
      <QueryProvider client={client}>
        <ClientProbe expected={client} label="isolated client" />
      </QueryProvider>,
    );

    expect(screen.getByText('isolated client')).toBeVisible();
  });
});
