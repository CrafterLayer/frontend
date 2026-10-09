import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { treeTextBubbleActions, TREE_TEXT_ACTION_LABELS_EN } from './tree-text-actions';
import { beginTreeTextEdit, isTreeTextEditable } from './tree-text-session';
import { storedTree, treeKernel } from './tree-test-kit';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Our story' }],
};

function heading() {
  const element = document.createElement('h2');
  element.setAttribute('data-ck-path', '0');
  element.append(document.createTextNode('Our story'));
  document.body.append(element);
  return element;
}

const target = { kind: 'tree' as const, nodeId: 'r1', path: [0] };

function textOf(tree: CustomCodeRoot) {
  const node = tree.children[0];
  return node?.kind === 'element' ? node.text : undefined;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('in-place tree text editing (DESIGN §E)', () => {
  it('commits ONE patchTreeNode {text} on Enter and puts React’s text node back', () => {
    const kernel = treeKernel([TREE]);
    const element = heading();
    const original = element.firstChild;
    const onEnd = vi.fn();
    beginTreeTextEdit({ kernel, element, target, storedText: 'Our story', name: 'Heading', onEnd });
    expect(element).toHaveAttribute('contenteditable', 'plaintext-only');
    // Typing edits the text node in place, as a browser does.
    (element.firstChild as Text).data = 'Our new story';
    const before = kernel.transactions().length;
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(kernel.transactions().length - before).toBe(1);
    expect(textOf(storedTree(kernel))).toBe('Our new story');
    // React's own node is back, with React's data; the render brings the new text.
    expect(element.firstChild).toBe(original);
    expect(element.textContent).toBe('Our story');
    expect(element).not.toHaveAttribute('contenteditable');
    expect(onEnd).toHaveBeenCalledWith('committed', 'keyboard');
  });

  it('types Space itself inside a tab button, so the button never activates and the edit stays open', () => {
    const kernel = treeKernel([TREE]);
    const element = document.createElement('button');
    element.setAttribute('role', 'tab');
    element.append(document.createTextNode('Our story'));
    document.body.append(element);
    const onClick = vi.fn();
    element.addEventListener('click', onClick);
    const onEnd = vi.fn();
    const session = beginTreeTextEdit({ kernel, element, target, storedText: 'Our story', name: 'Tab', onEnd });
    const selection = document.getSelection();
    const range = document.createRange();
    range.setStart(element.firstChild as Text, 3);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    element.dispatchEvent(down);
    element.dispatchEvent(up);
    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(element.textContent).toBe('Our  story');
    expect(element.childNodes).toHaveLength(1);
    expect(session.isOpen()).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('Escape cancels: no transaction, the stored text shows again', () => {
    const kernel = treeKernel([TREE]);
    const element = heading();
    const onEnd = vi.fn();
    beginTreeTextEdit({ kernel, element, target, storedText: 'Our story', name: 'Heading', onEnd });
    (element.firstChild as Text).data = 'Typed but abandoned';
    const before = kernel.transactions().length;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    element.dispatchEvent(escape);
    document.removeEventListener('keydown', outer);
    expect(kernel.transactions().length - before).toBe(0);
    expect(element.textContent).toBe('Our story');
    expect(onEnd).toHaveBeenCalledWith('cancelled', 'keyboard');
    // The key never reached the canvas's own Escape (which would leave the element).
    expect(outer).not.toHaveBeenCalled();
  });

  it('an unchanged blur writes nothing', () => {
    const kernel = treeKernel([TREE]);
    const element = heading();
    const onEnd = vi.fn();
    beginTreeTextEdit({ kernel, element, target, storedText: 'Our story', name: 'Heading', onEnd });
    const before = kernel.transactions().length;
    element.dispatchEvent(new FocusEvent('blur'));
    expect(kernel.transactions().length - before).toBe(0);
    expect(onEnd).toHaveBeenCalledWith('unchanged', 'blur');
  });

  it('the bubble’s Bold writes formatTreeText over the selected range in one transaction', () => {
    const kernel = treeKernel([TREE]);
    const element = heading();
    const session = beginTreeTextEdit({
      kernel,
      element,
      target,
      storedText: 'Our story',
      name: 'Heading',
      onEnd: vi.fn(),
    });
    // Select "story" (characters 4–9).
    const range = document.createRange();
    range.setStart(element.firstChild as Text, 4);
    range.setEnd(element.firstChild as Text, 9);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(session.selectionRange()).toEqual({ start: 4, end: 9 });
    const actions = treeTextBubbleActions(session, TREE_TEXT_ACTION_LABELS_EN, {
      onRequestLink: vi.fn(),
      onResult: vi.fn(),
    });
    const before = kernel.transactions().length;
    actions.find((action) => action.id === 'bold')?.run();
    expect(kernel.transactions().length - before).toBe(1);
    const node = storedTree(kernel).children[0];
    const runs = node?.kind === 'element' ? node.children : undefined;
    expect(runs?.map((run) => (run.kind === 'element' ? [run.tag, run.text] : []))).toEqual([
      ['span', 'Our '],
      ['strong', 'story'],
    ]);
  });

  it('only element leaves that hold text are editable in place', () => {
    expect(isTreeTextEditable({ kind: 'element', tag: 'p', text: 'x' })).toBe(true);
    expect(isTreeTextEditable({ kind: 'element', tag: 'img' })).toBe(false);
    expect(
      isTreeTextEditable({ kind: 'element', tag: 'p', children: [{ kind: 'element', tag: 'span', text: 'x' }] }),
    ).toBe(false);
    expect(isTreeTextEditable({ kind: 'icon', name: 'mail' })).toBe(false);
  });
});
