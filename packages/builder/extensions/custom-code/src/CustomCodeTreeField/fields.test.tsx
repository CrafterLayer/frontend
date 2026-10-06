import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  customCodeTree,
  customCss,
  isCustomCodeTreeSchema,
  isCustomCssSchema,
} from '@craftkit/builder-schema';
import { z } from 'zod';

import { builderCustomCode } from '../index';
import CustomCodeCssField from '../CustomCodeCssField/CustomCodeCssField';
import CustomCodeTreeField from './CustomCodeTreeField';

const tree = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'p-8',
      children: [{ kind: 'component', component: 'card' }],
    },
  ],
};

function renderTreeField(value: unknown, onChange = vi.fn()) {
  render(
    <CustomCodeTreeField
      schema={customCodeTree()}
      value={value}
      path={['tree']}
      onChange={onChange}
    />,
  );
  // block-parts (2026-10-06): the JSON source sits behind the advanced disclosure.
  fireEvent.click(screen.getByRole('button', { name: 'Edit source (advanced)' }));
  return { onChange, textarea: screen.getByLabelText('Composition tree') };
}

function renderCssField(value: unknown, onChange = vi.fn()) {
  render(
    <CustomCodeCssField schema={customCss()} value={value} path={['css']} onChange={onChange} />,
  );
  return { onChange, textarea: screen.getByLabelText('Custom CSS') };
}

describe('field resolution', () => {
  it('matches each control on the block declaration, never on a property name', () => {
    const types = builderCustomCode.contributes?.fieldTypes ?? [];
    const treeType = types.find((type) => type.id === 'craftkit.custom-code.tree');
    const cssType = types.find((type) => type.id === 'craftkit.custom-code.css');

    expect(treeType?.match(customCodeTree())).toBe(100);
    expect(treeType?.match(z.string())).toBe(0);
    expect(cssType?.match(customCss())).toBe(100);
    // A plain string prop — a title, a slug — must not capture the CSS editor.
    expect(cssType?.match(z.string().max(20_000).default(''))).toBe(0);
  });

  it('recognises the declarations through wrappers', () => {
    expect(isCustomCodeTreeSchema(customCodeTree().optional())).toBe(true);
    expect(isCustomCssSchema(customCss().optional())).toBe(true);
  });
});

describe('CustomCodeTreeField', () => {
  it('summarises the tree for a reader who will not read the JSON', () => {
    renderTreeField(tree);

    expect(screen.getByText(/1 element, and 1 block reference: card\./u)).toBeTruthy();
  });

  it('commits a valid edit once, on blur rather than per keystroke', () => {
    const { onChange, textarea } = renderTreeField(tree);
    const next = JSON.stringify({ kind: 'root', children: [] });

    fireEvent.change(textarea, { target: { value: next } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(textarea, { target: { value: next } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ kind: 'root', children: [] });
  });

  it('refuses malformed JSON and says so instead of storing it', () => {
    const { onChange, textarea } = renderTreeField(tree);

    fireEvent.blur(textarea, { target: { value: '{ not json' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Not valid JSON');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses a tree the door would reject, naming the failing path', () => {
    const { onChange, textarea } = renderTreeField(tree);
    const invalid = JSON.stringify({
      kind: 'root',
      children: [{ kind: 'element', tag: 'script' }],
    });

    fireEvent.blur(textarea, { target: { value: invalid } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does not dispatch when the text is unchanged', () => {
    const { onChange, textarea } = renderTreeField(tree);

    fireEvent.blur(textarea, { target: { value: JSON.stringify(tree, null, 2) } });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CustomCodeCssField', () => {
  it('stores stylesheet text the renderer will accept', () => {
    const { onChange, textarea } = renderCssField('');

    fireEvent.blur(textarea, { target: { value: '.ck-a { color: red }' } });

    expect(onChange).toHaveBeenCalledWith('.ck-a { color: red }');
  });

  it('applies the SAME refusal list the renderer does, at typing time', () => {
    // Without this the value stores fine and the stylesheet silently never
    // renders — a document value that does nothing, explained nowhere.
    const { onChange, textarea } = renderCssField('');

    fireEvent.blur(textarea, { target: { value: '@import url("https://evil.test/x.css");' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('@import');
  });

  it('refuses rather than strips, so nothing is removed behind the author back', () => {
    const { onChange, textarea } = renderCssField('.ck-a { color: red }');

    fireEvent.blur(textarea, { target: { value: '.ck-a { behavior: url(#x) }' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('.ck-a { behavior: url(#x) }');
  });

  it('points at the two conventions that make the feature work', () => {
    renderCssField('');

    const hint = screen.getByText(/Hook elements with/u);
    expect(hint.textContent).toContain('ck-');
    expect(hint.textContent).toContain('var(--t-accent)');
  });
});
