import { act, cleanup, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { PreviewMode } from '../PreviewMode';
import { EditorCanvas } from './EditorCanvas';
import { applyFrameLang } from './frame-lang';

/*
  library-playground (agent-script DESIGN §B.1.6): every frame read lang="" —
  the canvas and Preview now carry the document's language: the root `lang`
  prop, else `ar` for RTL and `en` for LTR, kept current as either changes.
*/

afterEach(cleanup);

const SlotRender = ((props: BlockRenderProps) => <div>{props.slots['default']}</div>) as unknown as BlockRenderComponent;
const TextRender = ((props: BlockRenderProps<{ content: string }>) => (
  <p>{props.props.content}</p>
)) as unknown as BlockRenderComponent;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'frame-lang-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({ lang: z.string().max(12).default('') }),
          slots: { default: { allow: ['text'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'text',
          description: 'Text',
          props: z.object({ content: z.string().default('') }),
          examples: [],
        }),
        render: TextRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: { lang: '' }, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: { content: 'Hello' } },
  },
};

const makeKernel = () =>
  createBuilder({ document: DOC, extensions: [VOCAB], ports: { clock: fixedClock(), ids: seededIds('fl') } });

const frameLang = (title: string) =>
  screen.getByTitle<HTMLIFrameElement>(title).contentDocument?.documentElement.getAttribute('lang');

describe('applyFrameLang', () => {
  it('writes the tag on the frame root, and is a no-op without a frame', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    applyFrameLang(frame, 'ar');
    expect(frame.contentDocument?.documentElement.getAttribute('lang')).toBe('ar');
    expect(() => {
      applyFrameLang(null, 'en');
    }).not.toThrow();
    frame.remove();
  });
});

describe('frame <html lang> follows the page', () => {
  it('Preview: dir decides until the root names a language; a view flip does not change it', () => {
    const kernel = makeKernel();
    const view = render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={() => undefined} />);
    expect(frameLang('Preview')).toBe('en');
    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    expect(frameLang('Preview')).toBe('ar');
    act(() => {
      kernel.dispatch('setProp', { id: 'root', key: 'lang', value: 'ar-JO' });
    });
    expect(frameLang('Preview')).toBe('ar-JO');
    act(() => {
      kernel.dispatch('setProp', { id: 'root', key: 'lang', value: '' });
      kernel.dispatch('setDocMeta', { dir: 'ltr' });
    });
    expect(frameLang('Preview')).toBe('en');
    // The Preview direction flip is view state over the same English words.
    view.rerender(<PreviewMode kernel={kernel} theme={lightTheme} dirOverride="rtl" onExit={() => undefined} />);
    expect(screen.getByTitle<HTMLIFrameElement>('Preview').contentDocument?.documentElement.getAttribute('dir')).toBe('rtl');
    expect(frameLang('Preview')).toBe('en');
  });

  it('the editor canvas frame carries the same tag and follows a direction change', () => {
    const kernel = makeKernel();
    const ports: Partial<GeometryPorts> = {
      measure: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      hitTest: () => null,
      viewport: () => ({ width: 400, height: 600 }),
      schedule: () => () => undefined,
    };
    render(<EditorCanvas kernel={kernel} theme={lightTheme} geometryPorts={ports} />);
    expect(frameLang('Editor canvas')).toBe('en');
    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    expect(frameLang('Editor canvas')).toBe('ar');
  });
});
