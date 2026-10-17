import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBuilder, emptyDocument } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyRichText,
  partStylesProp,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type FieldProps,
  type FieldTypeDef,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { FieldCommit } from '../../fields/field-commit';
import { InspectorRowBody } from './InspectorRowBody';
import type { InspectorRowBodyProps } from './types';

afterEach(cleanup);

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'Inspector', 'InspectorRow.css'),
  'utf8',
);

const kernel = createBuilder({
  document: emptyDocument(),
  ports: { clock: fixedClock(), ids: seededIds('rb') },
});

const baseProps = (overrides: Partial<InspectorRowBodyProps> = {}): InspectorRowBodyProps => ({
  kernel,
  nodeId: 'root',
  propKey: 'lineHeight',
  schema: z.number().default(24),
  palette: [],
  bucket: 'base',
  value: 24,
  baseValue: 24,
  hasOverride: false,
  catalogVersion: 0,
  announce: () => undefined,
  dir: 'ltr',
  ...overrides,
});

describe('InspectorRowBody', () => {
  it('declares the mono face and tabular digits on numeric values', () => {
    expect(CSS_SOURCE).toMatch(
      /\.bldr-inspector__numeric-control \.bldr-field__input\s*\{[^}]*font-family:\s*var\(--bldr-font-mono\);[^}]*font-variant-numeric:\s*tabular-nums;[^}]*\}/su,
    );
  });

  it('lays out label, control and unit: label[for], hidden key, unit as the input’s next sibling', () => {
    render(<InspectorRowBody {...baseProps()} />);
    const input = screen.getByRole('spinbutton', { name: 'lineHeight' });
    const row = input.closest('.bldr-inspector__row');
    expect(row).not.toBeNull();
    expect(row?.className).toBe('bldr-inspector__row');
    const label = row?.querySelector('label');
    expect(label).toHaveAttribute('for', input.id);
    expect(label?.querySelector('[aria-hidden="true"]')).toHaveTextContent('Line height');
    expect(label?.querySelector('.bldr-visually-hidden')).toHaveTextContent('lineHeight');
    const unit = input.nextElementSibling;
    expect(unit).toHaveClass('bldr-inspector__unit');
    expect(unit).toHaveAttribute('aria-hidden', 'true');
    expect(unit).toHaveTextContent('px');
    expect(screen.queryByRole('img', { name: 'Supports device overrides' })).toBeNull();
  });

  it('describes the control by its override marker and shows the device glyph only on capable root rows', () => {
    render(
      <InspectorRowBody
        {...baseProps({ bucket: 'tablet', value: 20, hasOverride: true, responsiveCapable: true })}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'lineHeight' });
    const marker = screen.getByText('tablet override');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(marker.id);
    expect(screen.getByRole('button', { name: 'Clear lineHeight override' })).toHaveClass(
      'bldr-inspector__override-clear',
    );
    expect(screen.getByRole('img', { name: 'Supports device overrides' })).toBeInTheDocument();
  });

  it('keeps a nested deferred draft while the incoming value holds and drops it when the value moves', async () => {
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: false, message: 'kept as a draft' }));
    const user = userEvent.setup();
    const props = baseProps({
      propKey: 'name',
      schema: z.string().max(40),
      value: 'a',
      baseValue: 'a',
      nested: true,
      deferTextCommit: true,
      commitValue,
    });
    const view = render(<InspectorRowBody {...props} />);
    const input = screen.getByRole('textbox', { name: 'name' });
    await user.type(input, 'b');
    expect(input).toHaveValue('ab');
    expect(commitValue).not.toHaveBeenCalled();

    view.rerender(<InspectorRowBody {...props} />);
    expect(input).toHaveValue('ab');

    view.rerender(<InspectorRowBody {...props} value="z" baseValue="z" />);
    expect(input).toHaveValue('z');
  });

  it('commits a nested draft once on Enter and keeps the rejection on its own row', async () => {
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: false, message: 'nested no' }));
    const user = userEvent.setup();
    render(
      <InspectorRowBody
        {...baseProps({
          propKey: 'name',
          schema: z.string().max(40),
          value: 'a',
          baseValue: 'a',
          nested: true,
          deferTextCommit: true,
          commitValue,
        })}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'name' });
    await user.type(input, 'b{Enter}');
    expect(commitValue).toHaveBeenCalledTimes(1);
    expect(commitValue).toHaveBeenCalledWith('ab');
    const rejection = screen.getByText('nested no');
    expect(rejection).toHaveClass('bldr-inspector__rejection');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(rejection.id);
    expect(input).toHaveValue('ab');
  });
});

/*
  block-parts P3 behaviour gates for the row: every field kind reaches a real
  editor, nothing shows raw JSON, and the rich-text stand-in is the skeleton.
*/

const NullRender: BlockRenderComponent = () => null;

const promoSchema = defineBlockSchema({
  type: 'promo',
  description: 'Promo',
  props: z.object({
    heading: z.string().max(80).default('Hello'),
    body: z.string().default(''),
    link: z.object({ label: z.string().max(60), href: z.string().max(400) }).default({
      label: 'More',
      href: '/more',
    }),
    cta: z
      .object({
        label: z.string().max(60),
        href: z.string().max(400),
        newTab: z.boolean().default(false),
      })
      .default({ label: 'Watch', href: '/film', newTab: false }),
    imageSrc: z.string().max(400).default(''),
    content: richText().default(emptyRichText() as never),
    partStyles: partStylesProp(),
  }),
  parts: {
    heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
    link: {
      kind: 'link',
      bind: { text: 'link.label', href: 'link.href' },
      label: { en: 'Link', ar: 'الرابط' },
    },
    image: { kind: 'image', bind: { src: 'imageSrc' }, label: { en: 'Image', ar: 'الصورة' } },
  },
  examples: [],
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'row-fields-vocab',
  version: '1.0.0',
  contributes: { blocks: [{ schema: promoSchema, render: NullRender }] },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'p1',
  nodes: {
    p1: {
      id: 'p1',
      type: 'promo',
      props: {
        heading: 'Hello',
        body: 'Build a site that grows with you.',
        link: { label: 'More', href: '/more' },
        cta: { label: 'Watch', href: '/film', newTab: false },
        imageSrc: '/img/a.png',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prose words.' }] }],
        },
        partStyles: { heading: { className: 'ps-4', dir: 'ltr' } },
      },
    },
  },
};

const makePromoKernel = (extra: TrustedExtensionManifest[] = []) =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB, ...extra],
    ports: { clock: fixedClock(), ids: seededIds('rf') },
  });

const shape = (promoSchema.props as unknown as { shape: Record<string, z.ZodType> }).shape;

function rowProps(
  kernel: ReturnType<typeof makePromoKernel>,
  propKey: string,
  overrides: Partial<InspectorRowBodyProps> = {},
): InspectorRowBodyProps {
  const value = kernel.getDocument().nodes['p1']?.props[propKey];
  return {
    kernel,
    nodeId: 'p1',
    propKey,
    schema: shape[propKey]!,
    palette: [],
    bucket: 'base',
    value,
    baseValue: value,
    hasOverride: false,
    catalogVersion: kernel.extensions.version(),
    announce: () => undefined,
    dir: 'ltr',
    ...overrides,
  };
}

const propOf = (kernel: ReturnType<typeof makePromoKernel>, key: string) =>
  kernel.getDocument().nodes['p1']?.props[key];

describe('InspectorRowBody — every field kind has an editor (block-parts P3)', () => {
  it('a long string is an auto-grow paragraph box following its own direction', () => {
    const kernel = makePromoKernel();
    render(<InspectorRowBody {...rowProps(kernel, 'body')} />);
    const box = screen.getByRole('textbox', { name: 'body' });
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('dir', 'auto');
  });

  it('a link part’s object row is a LinkField; one edit is one setProp', async () => {
    const user = userEvent.setup();
    const kernel = makePromoKernel();
    render(<InspectorRowBody {...rowProps(kernel, 'link')} />);
    const text = screen.getByRole('textbox', { name: 'Link text' });
    await user.clear(text);
    await user.type(text, 'Read the docs');
    await user.tab();
    expect(propOf(kernel, 'link')).toEqual({ label: 'Read the docs', href: '/more' });
    expect(document.body.textContent).not.toContain('{"label"');
  });

  it('an image part’s src is an ImageUrlField — by declaration, not by name', () => {
    const kernel = makePromoKernel();
    render(<InspectorRowBody {...rowProps(kernel, 'imageSrc')} />);
    expect(screen.getByRole('textbox', { name: 'imageSrc' })).toHaveAttribute('dir', 'ltr');
    expect(document.querySelector('.bldr-image-url-field')).not.toBeNull();
  });

  it('a plain object is grouped sub-rows; a sub-edit writes the object once', async () => {
    const user = userEvent.setup();
    const kernel = makePromoKernel();
    render(<InspectorRowBody {...rowProps(kernel, 'cta')} />);
    const group = screen.getByRole('group', { name: 'cta' });
    const sw = within(group).getByRole('switch', { name: 'newTab' });
    await user.click(sw);
    expect(propOf(kernel, 'cta')).toEqual({ label: 'Watch', href: '/film', newTab: true });
  });

  it('partStyles lists parts by label and resets one as ONE labelled transaction', async () => {
    const user = userEvent.setup();
    const kernel = makePromoKernel();
    const group = vi.spyOn(kernel, 'dispatchGroup');
    render(<InspectorRowBody {...rowProps(kernel, 'partStyles')} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Heading' }));
    expect(group).toHaveBeenCalledTimes(1);
    expect(group.mock.calls[0]?.[1]).toMatchObject({ author: 'user' });
    expect(propOf(kernel, 'partStyles')).toEqual({});
  });
});

describe('InspectorRowBody — the rich-text stand-in is never JSON', () => {
  const Rich = (props: FieldProps) => <div data-testid="rich-editor">{props.path.join('.')}</div>;

  const richField = (load: FieldTypeDef['load']): TrustedExtensionManifest => ({
    tier: 1,
    name: `rich-${String(Math.random())}`,
    version: '1.0.0',
    contributes: {
      fieldTypes: [
        {
          id: `rich-${String(Math.random())}`,
          match: (schema) => (schema === shape['content'] ? 100 : 0),
          load,
        },
      ],
    },
  });

  it('while the editor loads: a disabled skeleton holding the words', () => {
    const kernel = makePromoKernel([richField(() => new Promise(() => undefined))]);
    render(<InspectorRowBody {...rowProps(kernel, 'content')} />);
    const surface = screen.getByRole('textbox', { name: 'content' });
    expect(surface).toBeDisabled();
    expect(surface).toHaveValue('Prose words.');
    expect(document.body.textContent).not.toContain('"type"');
    expect(screen.getByRole('status')).toHaveTextContent('Loading the text editor…');
  });

  it('a failed load shows the sentence and Retry, and Retry mounts the editor', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const kernel = makePromoKernel([
      richField(() => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('Failed to fetch dynamically imported module'))
          : Promise.resolve({ default: Rich });
      }),
    ]);
    render(<InspectorRowBody {...rowProps(kernel, 'content')} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to fetch dynamically imported module',
    );
    expect(screen.getByRole('textbox', { name: 'content' })).toHaveValue('Prose words.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('rich-editor')).toBeInTheDocument();
  });

  it('an editor that throws is contained as the skeleton with its error', async () => {
    const Throws = () => {
      throw new Error('editor exploded');
    };
    const kernel = makePromoKernel([richField(() => Promise.resolve({ default: Throws }))]);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<InspectorRowBody {...rowProps(kernel, 'content')} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('editor exploded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('"type"');
    quiet.mockRestore();
  });
});

describe('InspectorRowBody — paragraph rows finish on Enter (DESIGN §2.7)', () => {
  it('a nested paragraph commits once on Enter; Shift+Enter is a line break', async () => {
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: true }));
    const user = userEvent.setup();
    render(
      <InspectorRowBody
        {...baseProps({
          propKey: 'answer',
          schema: z.string(),
          value: 'Yes',
          baseValue: 'Yes',
          nested: true,
          deferTextCommit: true,
          commitValue,
        })}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'answer' });
    expect(box.tagName).toBe('TEXTAREA');
    await user.type(box, '{Shift>}{Enter}{/Shift}really');
    expect(commitValue).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(commitValue).toHaveBeenCalledTimes(1);
    expect(commitValue).toHaveBeenCalledWith('Yes\nreally');
  });
});
