import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fixtureBlocks, landingFixture } from '@craftkit/builder-core/testing';
import type {
  BlockRenderComponent,
  BlockRenderProps,
  RegisteredBlock,
} from '@craftkit/builder-schema';

import { StaticNode } from './StaticNode';

describe('StaticNode', () => {
  it('falls back to UnknownBlock when no renderer is registered', () => {
    render(
      <StaticNode
        document={landingFixture()}
        id="hero1"
        blocks={() => undefined}
        breakpoint="desktop"
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('hero');
  });

  it('renders nothing for a missing id', () => {
    const { container } = render(
      <StaticNode
        document={landingFixture()}
        id="ghost"
        blocks={() => undefined}
        breakpoint="desktop"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('supplies declared exposed slots as empty metadata when storage omits the slot', () => {
    const page = fixtureBlocks.contributes?.blocks?.find(
      (contribution) => contribution.schema.type === 'page',
    );
    if (page === undefined) throw new Error('page fixture block is missing');

    const Probe = (({ slots, slotChildren }: BlockRenderProps) => (
      <output
        data-testid="metadata-probe"
        data-has-slot={Object.hasOwn(slots, 'default')}
        data-has-metadata={Object.hasOwn(slotChildren ?? {}, 'default')}
        data-metadata-count={slotChildren?.['default']?.length}
      />
    )) as BlockRenderComponent;
    const exposedPage: RegisteredBlock = {
      schema: {
        ...page.schema,
        slots: {
          default: {
            allow: page.schema.slots?.['default']?.allow ?? [],
            exposeChildMetadata: true,
          },
        },
      },
      render: Probe,
    };
    const document = landingFixture();
    Reflect.deleteProperty(document.nodes[document.rootId]!, 'slots');

    render(
      <StaticNode
        document={document}
        id={document.rootId}
        blocks={(type) => (type === 'page' ? exposedPage : undefined)}
        breakpoint="desktop"
      />,
    );

    expect(screen.getByTestId('metadata-probe')).toHaveAttribute('data-has-slot', 'true');
    expect(screen.getByTestId('metadata-probe')).toHaveAttribute('data-has-metadata', 'true');
    expect(screen.getByTestId('metadata-probe')).toHaveAttribute('data-metadata-count', '0');
  });
});
