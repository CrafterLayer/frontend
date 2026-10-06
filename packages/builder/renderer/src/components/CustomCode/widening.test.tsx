import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  CUSTOM_CODE_IFRAME_SANDBOX,
  type BlockRenderProps,
  type CustomCodeNode,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { CustomCodeClassTransformContext } from './class-transform-context';
import { CustomCode } from './CustomCode';
import { CustomCodeRegistryContext, type CustomCodeBlockLookup } from './registry-context';
import { loadTablerIcons, setTablerIconLoader, tablerIconNode } from './tabler-icons';

/*
  style-manager DESIGN §A.1 / §D.1 (2026-10-05): tree components are
  addressable on the canvas, the new tags render with their forced guards,
  editor metadata never renders, and a host can rewrite every className.
*/

function Hero({ slots }: BlockRenderProps<{ tone: string }>) {
  return <div data-testid="hero">{slots['default']}</div>;
}

/* v8 ignore next 2 -- the fixture always carries the type. */
const heroSchema =
  (fixtureBlocks.contributes?.blocks ?? []).find((entry) => entry.schema.type === 'hero')?.schema ??
  (() => {
    throw new Error('missing hero');
  })();

const registry: Record<string, RegisteredBlock> = {
  hero: { schema: heroSchema, render: Hero as NonNullable<RegisteredBlock['render']> },
};
const lookup: CustomCodeBlockLookup = (type) => registry[type];

const tree = (...children: CustomCodeNode[]) => ({ kind: 'root' as const, children });

function renderTree(children: CustomCodeNode[], isCanvas: boolean) {
  return render(
    <CustomCodeRegistryContext.Provider value={lookup}>
      <CustomCode tree={tree(...children)} hostId="host1" isCanvas={isCanvas} />
    </CustomCodeRegistryContext.Provider>,
  );
}

const YOUTUBE = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

describe('tree components are addressable on the canvas only', () => {
  const component = { kind: 'component', component: 'hero', props: {} } as CustomCodeNode;

  it('wraps a component in a box-less, path-stamped wrapper on the canvas', () => {
    const { container, getByTestId } = renderTree(
      [{ kind: 'element', tag: 'p', text: 'a' }, component],
      true,
    );
    const wrapper = container.querySelector('[data-ck-component]');
    expect(wrapper?.getAttribute('data-ck-path')).toBe('1');
    expect(wrapper?.getAttribute('data-ck-component')).toBe('hero');
    expect((wrapper as HTMLElement | null)?.style.display).toBe('contents');
    expect(wrapper?.contains(getByTestId('hero'))).toBe(true);
  });

  it('wraps an unknown component too, so it can be selected and fixed', () => {
    const { container } = renderTree([{ kind: 'component', component: 'nope' }], true);
    expect(
      container.querySelector('[data-ck-component="nope"]')?.getAttribute('data-ck-path'),
    ).toBe('0');
  });

  it('renders the block alone on a published page', () => {
    const { container, getByTestId } = renderTree([component], false);
    expect(container.querySelector('[data-ck-component]')).toBeNull();
    expect(container.querySelector('[data-ck-path]')).toBeNull();
    expect(getByTestId('hero').parentElement?.hasAttribute('data-ck-custom-code')).toBe(true);
  });
});

describe('iframes', () => {
  it('forces the sandbox, lazy loading, the referrer policy and allow, whatever the tree says', () => {
    const { container } = renderTree(
      [
        {
          kind: 'element',
          tag: 'iframe',
          attributes: {
            src: YOUTUBE,
            title: 'Our story',
            loading: 'eager',
            // Not admitted: hand-edited documents cannot weaken the frame.
            sandbox: 'allow-top-navigation',
            allow: 'camera',
          } as never,
        },
      ],
      false,
    );
    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(YOUTUBE);
    expect(frame?.getAttribute('title')).toBe('Our story');
    expect(frame?.getAttribute('sandbox')).toBe(CUSTOM_CODE_IFRAME_SANDBOX);
    expect(frame?.getAttribute('loading')).toBe('lazy');
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame?.getAttribute('allow')).toMatch(/encrypted-media/u);
    expect(frame?.getAttribute('allow')).not.toMatch(/camera/u);
  });

  it('drops a src outside the allowlist rather than framing it', () => {
    const { container } = renderTree(
      [
        {
          kind: 'element',
          tag: 'iframe',
          attributes: { src: 'https://evil.example/', title: 'x' },
        },
      ],
      false,
    );
    expect(container.querySelector('iframe')?.hasAttribute('src')).toBe(false);
  });

  it('does not take the pointer on the canvas, so a click selects it', () => {
    const { container } = renderTree(
      [{ kind: 'element', tag: 'iframe', attributes: { src: YOUTUBE, title: 'x' } }],
      true,
    );
    expect(container.querySelector('iframe')?.style.pointerEvents).toBe('none');
  });
});

describe('forms and links', () => {
  const form = (behaviour: boolean): CustomCodeNode => ({
    kind: 'element',
    tag: 'form',
    attributes: behaviour
      ? { 'data-ck-behavior': 'whatsapp-form', 'data-ck-phone': '+962790000000' }
      : {},
    children: [
      { kind: 'element', tag: 'label', attributes: { for: 'n' }, text: 'Name' },
      {
        kind: 'element',
        tag: 'input',
        attributes: { id: 'n', name: 'n', value: 'Reem', type: 'text' },
      },
      { kind: 'element', tag: 'input', attributes: { type: 'checkbox', checked: '' } },
      { kind: 'element', tag: 'textarea', text: 'Hello' },
      { kind: 'element', tag: 'button', attributes: { type: 'submit' }, text: 'Send' },
    ],
  });

  it('inputs are inert on the canvas: no tab stop, read-only', () => {
    const { container } = renderTree([form(true)], true);
    const input = container.querySelector<HTMLInputElement>('input[name="n"]');
    expect(input?.tabIndex).toBe(-1);
    expect(input?.readOnly).toBe(true);
    expect(input?.value).toBe('Reem');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(container.querySelector('textarea')?.value).toBe('Hello');
    expect(container.querySelector('label')?.getAttribute('for')).toBe('n');
  });

  it('a submit button submits only inside a WhatsApp form', () => {
    expect(
      renderTree([form(true)], false)
        .container.querySelector('button')
        ?.getAttribute('type'),
    ).toBe('submit');
    expect(
      renderTree([form(false)], false)
        .container.querySelector('button')
        ?.getAttribute('type'),
    ).toBe('button');
  });

  it('a new-tab link gets noopener beside the authored relationship', () => {
    const { container } = renderTree(
      [
        {
          kind: 'element',
          tag: 'a',
          attributes: { href: '/about', target: '_blank', rel: 'nofollow' },
          text: 'a',
        },
        {
          kind: 'element',
          tag: 'a',
          attributes: { href: 'https://x.example', rel: 'sponsored' },
          text: 'b',
        },
      ],
      false,
    );
    const [first, second] = [...container.querySelectorAll('a')];
    expect(first?.getAttribute('rel')).toBe('nofollow noopener');
    expect(second?.getAttribute('rel')).toBe('sponsored noopener noreferrer');
  });
});

describe('editor metadata and class transforms', () => {
  it('never renders label or locked', () => {
    const html = renderToStaticMarkup(
      <CustomCode
        hostId="h"
        isCanvas
        tree={tree({
          kind: 'element',
          tag: 'h2',
          text: 'Title',
          label: 'Hero heading',
          locked: true,
        })}
      />,
    );
    expect(html).not.toMatch(/Hero heading/u);
    expect(html).not.toMatch(/locked/u);
    expect(html).toMatch(/<h2[^>]*>Title<\/h2>/u);
  });

  it('applies the host transform to every element and icon className', () => {
    const { container } = render(
      <CustomCodeClassTransformContext.Provider
        value={(className) => className.replace('ck-s-card', 'p-4 rounded-lg')}
      >
        <CustomCode
          hostId="h"
          tree={tree(
            { kind: 'element', tag: 'div', className: 'ck-s-card bg-surface' },
            { kind: 'icon', name: 'mail', className: 'ck-s-card' },
          )}
        />
      </CustomCodeClassTransformContext.Provider>,
    );
    expect(container.querySelector('[data-ck-custom-code] > div')?.getAttribute('class')).toBe(
      'p-4 rounded-lg bg-surface',
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('p-4 rounded-lg');
  });

  it('renders drawn svg text', () => {
    const html = renderToStaticMarkup(
      <CustomCode
        hostId="h"
        tree={tree({
          kind: 'element',
          tag: 'svg',
          attributes: { viewBox: '0 0 100 20' },
          children: [
            {
              kind: 'element',
              tag: 'text',
              attributes: { x: '0', y: '15', 'text-anchor': 'start' },
              text: 'مرحبا',
            },
            { kind: 'element', tag: 'rect', text: 'never drawn' },
          ],
        })}
      />,
    );
    expect(html).toMatch(/<text x="0" y="15" text-anchor="start">مرحبا<\/text>/u);
    expect(html).not.toMatch(/never drawn/u);
  });
});

describe('Tabler icons', () => {
  afterEach(() => {
    setTablerIconLoader();
  });

  const sets = {
    outline: {
      heart: [
        ['path', { d: 'M1 1h2' }],
        ['script', { d: 'x' }],
        ['path', { d: 'M2 2', onload: 'x', fill: 'url(https://evil)' }],
      ],
    },
    filled: { heart: [['path', { d: 'M3 3h4', fill: 'currentColor' }]] },
  };

  it('keeps the box until the set loads, then draws it', async () => {
    let release: () => void = () => undefined;
    setTablerIconLoader(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(sets);
          };
        }),
    );
    const { container } = render(
      <CustomCode hostId="h" tree={tree({ kind: 'icon', name: 'tabler:heart', size: 20 })} />,
    );
    const pending = container.querySelector('svg');
    expect(pending?.hasAttribute('data-ck-icon-pending')).toBe(true);
    expect(pending?.getAttribute('aria-hidden')).toBe('true');
    expect(pending?.getAttribute('width')).toBe('20');
    await act(async () => {
      release();
      await loadTablerIcons();
    });
    const drawn = container.querySelector('svg');
    expect(drawn?.hasAttribute('data-ck-icon-pending')).toBe(false);
    expect(drawn?.querySelectorAll('path')).toHaveLength(2);
    expect(drawn?.innerHTML).not.toMatch(/script|onload|evil/u);
  });

  it('draws a filled icon painted, not stroked, in a static render once loaded', async () => {
    setTablerIconLoader(() => Promise.resolve(sets));
    await loadTablerIcons();
    expect(tablerIconNode('heart', 'filled')).toEqual([
      ['path', { d: 'M3 3h4', fill: 'currentColor' }],
    ]);
    const html = renderToStaticMarkup(
      <CustomCode
        hostId="h"
        tree={tree({ kind: 'icon', name: 'tabler-filled:heart', label: 'Love' })}
      />,
    );
    expect(html).toMatch(/fill="currentColor"/u);
    expect(html).toMatch(/stroke="none"/u);
    expect(html).toMatch(/aria-label="Love"/u);
  });

  it('shows the visible unknown-icon mark when the set failed to load or lacks the name', async () => {
    setTablerIconLoader(() => Promise.reject(new Error('offline')));
    expect(await loadTablerIcons()).toBe(false);
    const html = renderToStaticMarkup(
      <CustomCode hostId="h" tree={tree({ kind: 'icon', name: 'tabler:heart' })} />,
    );
    expect(html).toMatch(/Unknown icon: tabler:heart/u);
  });
});
