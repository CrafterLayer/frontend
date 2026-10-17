import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import {
  anchorPathOf,
  isDomNode,
  isEditableTarget,
  nameWithin,
  PART_ANCHOR_PATH,
} from './canvas-targets';
import { EDITOR_CANVAS_LABELS_EN } from './EditorCanvas.labels';
import { TEST_BLOCKS, TEST_DOC } from './EditorCanvas.test-helpers';

describe('isEditableTarget / isDomNode', () => {
  it('form controls and contenteditable regions own their keys; plain elements do not', () => {
    document.body.innerHTML = `
      <input id="field" />
      <textarea id="area"></textarea>
      <div contenteditable="true"><span id="inside">text</span></div>
      <div contenteditable="false"><span id="off">text</span></div>
      <button id="button">Go</button>`;
    const byId = (id: string) => document.getElementById(id);
    expect(isEditableTarget(byId('field'))).toBe(true);
    expect(isEditableTarget(byId('area'))).toBe(true);
    expect(isEditableTarget(byId('inside'))).toBe(true);
    expect(isEditableTarget(byId('off'))).toBe(false);
    expect(isEditableTarget(byId('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('accepts nodes from another realm by shape, never by instanceof', () => {
    expect(isDomNode(document.createTextNode('x'))).toBe(true);
    expect(isDomNode(new EventTarget())).toBe(false);
    expect(isDomNode(null)).toBe(false);
  });
});

describe('nameWithin', () => {
  it('names the element inside its region', () => {
    expect(nameWithin(EDITOR_CANVAS_LABELS_EN, 'Heading', 'Hero')).toBe(
      EDITOR_CANVAS_LABELS_EN.within('Heading', 'Hero'),
    );
  });

  it('never repeats a region the element name already carries, nor an empty one', () => {
    expect(nameWithin(EDITOR_CANVAS_LABELS_EN, 'Button label · Get started', 'get started')).toBe(
      'Button label · Get started',
    );
    expect(nameWithin(EDITOR_CANVAS_LABELS_EN, ' Image ', '  ')).toBe('Image');
  });
});

describe('anchorPathOf (what the floating bars anchor to)', () => {
  const kernel = () =>
    createBuilder({
      document: TEST_DOC,
      extensions: [TEST_BLOCKS],
      ports: { clock: fixedClock(), ids: seededIds('anchor') },
    });

  it('the block itself when nothing inside it is focused', () => {
    const k = kernel();
    k.setSelection(['b']);
    expect(anchorPathOf(k.context.store.getState(), 'b')).toBeNull();
  });

  it('a focused element of the SELECTED node anchors at its path', () => {
    const k = kernel();
    k.setSelection(['b']);
    const state = { ...k.context.store.getState(), elementFocus: { id: 'b', path: [0, 1] } };
    expect(anchorPathOf(state, 'b')).toEqual([0, 1]);
    expect(anchorPathOf(state, 'c')).toBeNull();
  });

  it('a focused part anchors at the part sentinel', () => {
    const k = kernel();
    const state = {
      ...k.context.store.getState(),
      partFocus: { id: 'b', part: 'title', index: [] },
    };
    expect(anchorPathOf(state, 'b')).toBe(PART_ANCHOR_PATH);
  });
});
