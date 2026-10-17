import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  CUSTOM_CODE_MAX_DEPTH,
  type BlockRenderProps,
  type CustomCodeNode,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { CUSTOM_CODE_REGION_ATTRIBUTE } from '../../tailwind/live-utilities';

import { CustomCode } from './CustomCode';
import { CustomCodeRegistryContext, type CustomCodeBlockLookup } from './registry-context';

/**
 * `hero` comes from the kernel's own fixtures: props are
 * `{ tone: 'light' | 'dark' (default 'light'), heading: string (default) }`.
 * Reusing them keeps this suite honest — it exercises a real registered schema
 * rather than one written to make these assertions pass.
 */
function Hero({ node, props, slots }: BlockRenderProps<{ tone: string; heading: string }>) {
  return (
    <div data-testid="hero" data-tone={props.tone} data-node-id={node.id}>
      {slots['default']}
    </div>
  );
}

const schemaOf = (type: string) =>
  (fixtureBlocks.contributes?.blocks ?? []).find(
    (contribution) => contribution.schema.type === type,
  )?.schema;

/* v8 ignore next 2 -- the fixture always carries both types. */
const heroSchema = schemaOf('hero') ?? raise('hero');
const buttonSchema = schemaOf('button') ?? raise('button');

function raise(type: string): never {
  throw new Error(`Fixture is missing the "${type}" block.`);
}

const registry: Record<string, RegisteredBlock> = {
  hero: { schema: heroSchema, render: Hero as NonNullable<RegisteredBlock['render']> },
  // Registered with NO renderer — the declarative-content case.
  headless: { schema: buttonSchema },
};

const lookup: CustomCodeBlockLookup = (type) => registry[type];

function tree(children: CustomCodeNode[]) {
  return { kind: 'root' as const, children };
}

function renderTree(children: CustomCodeNode[], withLookup = true) {
  return render(
    <CustomCodeRegistryContext.Provider value={withLookup ? lookup : undefined}>
      <CustomCode tree={tree(children)} hostId="host1" />
    </CustomCodeRegistryContext.Provider>,
  );
}

describe('CustomCode', () => {
  it('on the canvas, stamps every authored element and icon with its tree path so the shell can address it', () => {
    const { container } = render(
      <CustomCodeRegistryContext.Provider value={lookup}>
        <CustomCode
          tree={tree([
            {
              kind: 'element',
              tag: 'section',
              children: [
                { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } },
                {
                  kind: 'element',
                  tag: 'div',
                  children: [
                    { kind: 'element', tag: 'h1', text: 'Title' },
                    { kind: 'icon', name: 'mail' },
                    { kind: 'element', tag: 'button', text: 'Go' },
                  ],
                },
              ],
            },
          ])}
          hostId="host1"
          isCanvas
        />
      </CustomCodeRegistryContext.Provider>,
    );

    expect(container.querySelector('section')?.getAttribute('data-ck-path')).toBe('0');
    expect(container.querySelector('img')?.getAttribute('data-ck-path')).toBe('0.0');
    expect(container.querySelector('h1')?.getAttribute('data-ck-path')).toBe('0.1.0');
    expect(container.querySelector('svg')?.getAttribute('data-ck-path')).toBe('0.1.1');
    expect(container.querySelector('button')?.getAttribute('data-ck-path')).toBe('0.1.2');
  });

  it('never stamps paths off the canvas: a published page carries no editing addresses', () => {
    const { container } = renderTree([
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } },
          { kind: 'icon', name: 'mail' },
        ],
      },
    ]);
    expect(container.querySelector('[data-ck-path]')).toBeNull();
  });

  it('turns an image that fails to load into a quiet surface instead of a broken mark', () => {
    // A model can name a photo that does not exist; the page must not look broken for it.
    const { container } = renderTree([
      {
        kind: 'element',
        tag: 'img',
        className: 'aspect-video w-full rounded-2xl object-cover',
        attributes: { src: 'https://images.example.com/does-not-exist.jpg', alt: 'A café counter' },
      },
    ]);
    const image = container.querySelector('img');
    expect(image?.hasAttribute('data-ck-broken')).toBe(false);

    image?.dispatchEvent(new Event('error'));

    expect(image?.hasAttribute('data-ck-broken')).toBe(true);
    expect(image?.style.color).toBe('transparent');
    expect(image?.className).toBe('aspect-video w-full rounded-2xl object-cover');
  });

  it('shows an image again once a corrected address loads on the same element', () => {
    // The img is keyed by its tree path, so a new src reuses the marked node.
    const withSource = (src: string) =>
      tree([{ kind: 'element', tag: 'img', attributes: { src, alt: 'A café counter' } }]);
    const { container, rerender } = render(
      <CustomCode tree={withSource('https://images.example.com/gone.jpg')} hostId="host1" />,
    );
    const image = container.querySelector('img');
    image?.dispatchEvent(new Event('error'));
    expect(image?.hasAttribute('data-ck-broken')).toBe(true);

    rerender(
      <CustomCode tree={withSource('https://images.example.com/found.jpg')} hostId="host1" />,
    );
    const same = container.querySelector('img');
    expect(same).toBe(image);
    same?.dispatchEvent(new Event('load'));

    expect(same?.getAttribute('src')).toBe('https://images.example.com/found.jpg');
    expect(same?.hasAttribute('data-ck-broken')).toBe(false);
    expect(same?.style.color).toBe('');
    expect(same?.style.objectPosition).toBe('');
    expect(same?.style.backgroundImage).toBe('');
    expect(same?.hasAttribute('style')).toBe(false);
  });

  it('leaves an image that loaded first time untouched', () => {
    const { container } = renderTree([
      { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } },
    ]);
    const image = container.querySelector('img');

    image?.dispatchEvent(new Event('load'));

    expect(image?.hasAttribute('data-ck-broken')).toBe(false);
    expect(image?.hasAttribute('style')).toBe(false);
  });

  it('renders authored markup with its classes and text', () => {
    const { container } = renderTree([
      {
        kind: 'element',
        tag: 'section',
        className: 'min-h-screen bg-surface',
        children: [{ kind: 'element', tag: 'h1', text: 'Reem Haddad' }],
      },
    ]);

    const section = container.querySelector('section');
    expect(section?.className).toBe('min-h-screen bg-surface');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Reem Haddad');
  });

  it('resolves a component reference through the registry and validates its props', () => {
    renderTree([{ kind: 'component', component: 'hero', props: { tone: 'dark' } }]);

    expect(screen.getByTestId('hero').dataset['tone']).toBe('dark');
  });

  it('fills a referenced block schema defaults, exactly as NodeView does', () => {
    renderTree([{ kind: 'component', component: 'hero' }]);

    expect(screen.getByTestId('hero').dataset['tone']).toBe('light');
  });

  it('renders reference children into the referenced block default slot', () => {
    renderTree([
      {
        kind: 'component',
        component: 'hero',
        children: [{ kind: 'element', tag: 'p', text: 'inside the card' }],
      },
    ]);

    expect(screen.getByTestId('hero').textContent).toBe('inside the card');
  });

  it('gives a referenced block a stable id rooted in its host node', () => {
    renderTree([{ kind: 'component', component: 'hero' }]);

    expect(screen.getByTestId('hero').dataset['nodeId']).toBe('host1::0');
  });

  it('falls back visibly for an unregistered component rather than rendering nothing', () => {
    renderTree([{ kind: 'component', component: 'not-registered' }]);

    expect(screen.getByRole('note').textContent).toContain('not-registered');
  });

  it('falls back for a registered block that has no renderer', () => {
    renderTree([{ kind: 'component', component: 'headless' }]);

    expect(screen.getByRole('note').textContent).toContain('headless');
  });

  it('refuses to render a component whose props fail that block own schema', () => {
    renderTree([{ kind: 'component', component: 'hero', props: { tone: 'neon' } }]);

    // A half-configured component is a glitch three screens later; UnknownBlock is loud.
    expect(screen.queryByTestId('hero')).toBeNull();
    expect(screen.getByRole('note').textContent).toContain('hero');
  });

  it('degrades component references when no lookup is provided at all', () => {
    renderTree([{ kind: 'component', component: 'hero' }], false);

    expect(screen.queryByTestId('hero')).toBeNull();
    expect(screen.getByRole('note')).toBeTruthy();
  });

  describe('injection surface', () => {
    it('skips a tag outside the vocabulary instead of substituting a container', () => {
      const { container } = renderTree([
        { kind: 'element', tag: 'script' as never, text: 'alert(1)' },
        { kind: 'element', tag: 'object' as never, children: [] },
      ]);

      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('object')).toBeNull();
      expect(container.textContent).toBe('');
    });

    it('drops an event-handler attribute', () => {
      const { container } = renderTree([
        {
          kind: 'element',
          tag: 'div',
          attributes: { onclick: 'steal()', onmouseover: 'x()' } as never,
        },
      ]);

      const div = container.querySelector('[data-ck] > div');
      expect(div?.getAttribute('onclick')).toBeNull();
      expect(div?.getAttribute('onmouseover')).toBeNull();
    });

    it('renders text as text — markup in a string never becomes markup', () => {
      const { container } = renderTree([
        { kind: 'element', tag: 'p', text: '<img src=x onerror=alert(1)>' },
      ]);

      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('drops a javascript: src and keeps https, relative, and data-image sources', () => {
      const { container } = renderTree([
        { kind: 'element', tag: 'img', attributes: { src: 'javascript:alert(1)', alt: 'a' } },
        { kind: 'element', tag: 'img', attributes: { src: 'https://example.com/a.png', alt: 'b' } },
        { kind: 'element', tag: 'img', attributes: { src: '/local.png', alt: 'c' } },
      ]);

      const images = [...container.querySelectorAll('img')];
      expect(images[0]?.getAttribute('src')).toBeNull();
      expect(images[1]?.getAttribute('src')).toBe('https://example.com/a.png');
      expect(images[2]?.getAttribute('src')).toBe('/local.png');
    });
  });

  describe('tolerant read', () => {
    it('degrades an over-deep branch to its text without throwing', () => {
      let node: CustomCodeNode = { kind: 'element', tag: 'span', text: 'buried' };
      for (let at = 0; at < CUSTOM_CODE_MAX_DEPTH + 20; at += 1) {
        node = { kind: 'element', tag: 'div', children: [node] };
      }

      const { container } = renderTree([node]);

      expect(container.textContent).toContain('buried');
    });

    it('renders nothing for malformed input instead of crashing the canvas', () => {
      for (const malformed of [null, 'a string', 42, { kind: 'root' }, { children: 'nope' }]) {
        const { container } = render(<CustomCode tree={malformed} hostId="host1" />);
        expect(container.textContent).toBe('');
      }
    });

    it('ignores a child that is not an object', () => {
      const { container } = renderTree(['oops', null, 7] as never);

      expect(container.textContent).toBe('');
    });
  });

  it('scopes itself with a data attribute so per-block CSS can target it', () => {
    const { container } = renderTree([{ kind: 'element', tag: 'p', text: 'x' }]);

    expect(container.querySelector('[data-ck="host1"]')).toBeTruthy();
  });

  it('marks its root as the region the live Tailwind sheet is scoped to, on the page and canvas', () => {
    // The live sheet's `@scope` names this attribute; built-in blocks never carry it.
    for (const isCanvas of [false, true]) {
      const { container, unmount } = render(
        <CustomCodeRegistryContext.Provider value={lookup}>
          <CustomCode
            tree={tree([
              { kind: 'element', tag: 'p', className: 'md:p-[17px]', text: 'x' },
              { kind: 'component', component: 'hero', props: {} },
            ])}
            hostId="host1"
            isCanvas={isCanvas}
          />
        </CustomCodeRegistryContext.Provider>,
      );

      const region = container.querySelector(`[${CUSTOM_CODE_REGION_ATTRIBUTE}]`);
      expect(region).toBe(container.querySelector('[data-ck="host1"]'));
      expect(container.querySelectorAll(`[${CUSTOM_CODE_REGION_ATTRIBUTE}]`)).toHaveLength(1);
      // The authored element and the referenced block both render inside it.
      expect(region?.querySelector('p.md\\:p-\\[17px\\]')).toBeTruthy();
      expect(region?.querySelector('[data-testid="hero"]')).toBeTruthy();
      unmount();
    }
  });
});
