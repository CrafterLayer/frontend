import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';

import { partsKernel } from '../style-tools/part-tools.fixtures';
import { buildElementIndex, type ElementIndex } from './element-index';
import { scriptToolNames } from './expand-scripts';
import { arabicKernel } from './script.fixtures';
import { camelStyleKey, nearestStyleKeys, normalizeStyleKey } from './style-keys';
import type { ScriptCall, ScriptElement } from './types';
import { callsToSteps, type CallMapResult, type WriteMapContext } from './write-map';

function indexOf(kernel: BuilderKernel): ElementIndex {
  return buildElementIndex(kernel, (id, key) => kernel.getDocument().nodes[id]?.props[key], { pageId: 'page' });
}

const CTX: WriteMapContext = { currentPage: 'page', site: false, tools: scriptToolNames(undefined) };

function find(index: ElementIndex, predicate: (element: ScriptElement) => boolean): ScriptElement {
  const hit = index.elements.find(predicate);
  if (hit === undefined) throw new Error('fixture: no such element');
  return hit;
}

function steps(result: CallMapResult) {
  if (!result.ok) throw new Error(result.error.message);
  return [...result.byPage.values()].flat().map(({ step }) => step);
}

function error(result: CallMapResult): string {
  return result.ok ? '' : result.error.message;
}

const set = (targets: readonly string[], value: Record<string, unknown>, n = 1, line = 3): ScriptCall =>
  ({ n, line, op: 'set', targets, value });
const style = (targets: readonly string[], styles: Record<string, unknown>, options?: Record<string, unknown>, n = 1, line = 4): ScriptCall =>
  ({ n, line, op: 'style', targets, styles, ...(options === undefined ? {} : { options }) }) as ScriptCall;

describe('callsToSteps — tree elements', () => {
  const index = indexOf(arabicKernel());

  it('set {text} on an element with one text → a raw patchTreeNode at its text path', () => {
    const h1 = find(index, (el) => el.tag === 'h1');
    expect(steps(callsToSteps([set([h1.id], { text: 'قهوة طازجة' })], index.handles, CTX))).toEqual([
      { command: 'patchTreeNode', args: { id: 'r-hero', path: [0, 0], set: { text: 'قهوة طازجة' } } },
    ]);
    const wrapped = find(index, (el) => el.kind === 'button' && el.text === 'اعرف أكثر');
    expect(steps(callsToSteps([set([wrapped.id], { text: 'المزيد' })], index.handles, CTX))[0]?.args).toMatchObject({ path: [0, 4, 0] });
  });

  it('set {text} on mixed content → E_BAD_TARGET naming a child to target', () => {
    const card = find(index, (el) => el.kind === 'card' && el.node === 'r-services');
    const message = error(callsToSteps([set([card.id], { text: 'x' }, 2, 7)], index.handles, CTX));
    expect(message).toMatch(/^E_BAD_TARGET call #2 \(line 7\): element .* mixes text and children; target its child: ck\.find\(\{section:'r-services', kind:'text'\}\)/u);
  });

  it('set {href|src|alt} → element.attr; an image refuses text', () => {
    const link = find(index, (el) => el.kind === 'link');
    expect(steps(callsToSteps([set([link.id], { href: '#new' })], index.handles, CTX))).toEqual([
      { command: 'tool', args: { name: 'element.attr', input: { id: 'r-header', path: [0, 0], set: { href: '#new' } } } },
    ]);
    const image = find(index, (el) => el.kind === 'image');
    expect(steps(callsToSteps([set([image.id], { src: 'https://example.com/x.jpg', alt: 'x' })], index.handles, CTX))[0]?.args).toMatchObject({
      name: 'element.attr',
      input: { set: { src: 'https://example.com/x.jpg', alt: 'x' } },
    });
    expect(error(callsToSteps([set([image.id], { text: 'x' })], index.handles, CTX))).toContain('has no text; set {src, alt}');
  });

  it('style → element.style with the vocabulary ids, options as bucket/state', () => {
    const buttons = index.elements.filter((el) => el.kind === 'button' && el.id.startsWith('t|'));
    const produced = steps(callsToSteps([style(buttons.map(({ id }) => id), { 'border-radius': 'full', color: 'accent' }, { state: 'hover' })], index.handles, CTX));
    expect(produced).toHaveLength(buttons.length);
    expect(produced[0]).toEqual({
      command: 'tool',
      args: {
        name: 'element.style',
        input: {
          id: 'r-header',
          path: [0, 2],
          styles: [
            { property: 'borderRadius', value: 'full', state: 'hover' },
            { property: 'textColor', value: 'accent', state: 'hover' },
          ],
        },
      },
    });
  });

  it('style on a customCode section → element.style on its top element', () => {
    const section = find(index, (el) => el.kind === 'section' && el.node === 'r-hero');
    expect(steps(callsToSteps([style([section.id], { bg: 'surface', padding: { value: '8', bucket: 'mobile' } })], index.handles, CTX))).toEqual([
      {
        command: 'tool',
        args: {
          name: 'element.style',
          input: {
            id: 'r-hero',
            path: [0],
            styles: [
              { property: 'backgroundColor', value: 'surface' },
              { property: 'padding', value: '8', bucket: 'mobile' },
            ],
          },
        },
      },
    ]);
  });

  it('set on a section → E_BAD_TARGET pointing at its heading', () => {
    const section = find(index, (el) => el.kind === 'section' && el.node === 'r-hero');
    expect(error(callsToSteps([set([section.id], { text: 'x' })], index.handles, CTX))).toContain(
      "a section has no own text; use ck.find({section:'r-hero', kind:'heading'})",
    );
  });

  it('an id the index never handed out → E_BAD_TARGET', () => {
    expect(error(callsToSteps([set(['t|page|r-hero|[9]'], { text: 'x' })], index.handles, CTX))).toMatch(
      /^E_BAD_TARGET call #1 \(line 3\): .*not an element from ck\.find\(\)\. Pass elements returned by ck\.find\(\), not ids you wrote\./u,
    );
  });
});

describe('callsToSteps — registered-block parts', () => {
  const index = indexOf(partsKernel());

  it('set {text} on a text part → part.text; on a repeated part with its index', () => {
    const heading = find(index, (el) => el.node === 'hero-1' && el.part === 'heading');
    expect(steps(callsToSteps([set([heading.id], { text: 'Welcome' })], index.handles, CTX))).toEqual([
      { command: 'tool', args: { name: 'part.text', input: { id: 'hero-1', part: 'heading', text: 'Welcome' } } },
    ]);
    const second = find(index, (el) => el.part === 'item.title' && el.index === 1);
    expect(steps(callsToSteps([set([second.id], { text: 'Secure' })], index.handles, CTX))[0]?.args).toEqual({
      name: 'part.text',
      input: { id: 'features-1', part: 'item.title', index: 1, text: 'Secure' },
    });
  });

  it('set {text, href} on a button part → part.link; {src, alt} on an image part → part.image', () => {
    const cta = find(index, (el) => el.node === 'cta-1');
    expect(steps(callsToSteps([set([cta.id], { text: 'Start', href: '/go' })], index.handles, CTX))[0]?.args).toEqual({
      name: 'part.link',
      input: { id: 'cta-1', part: 'button', text: 'Start', href: '/go' },
    });
    const image = find(index, (el) => el.part === 'image');
    expect(steps(callsToSteps([set([image.id], { alt: 'A team' })], index.handles, CTX))[0]?.args).toEqual({
      name: 'part.image',
      input: { id: 'features-1', part: 'image', alt: 'A team' },
    });
    expect(error(callsToSteps([set([image.id], { text: 'x' })], index.handles, CTX))).toContain('is an image');
  });

  it('style on a part → part.style, per-entry bucket kept', () => {
    const titles = index.elements.filter((el) => el.part === 'item.title');
    const produced = steps(callsToSteps([style(titles.map(({ id }) => id), { fontWeight: 'bold', fontSize: { value: 'xl', bucket: 'mobile' } })], index.handles, CTX));
    expect(produced).toHaveLength(3);
    expect(produced[2]?.args).toEqual({
      name: 'part.style',
      input: { id: 'features-1', part: 'item.title', index: 2, style: { fontWeight: 'bold', fontSize: { value: 'xl', bucket: 'mobile' } } },
    });
  });

  it('style on a registered-block section without a root part → E_BAD_TARGET (theme.apply or one part)', () => {
    const section = find(index, (el) => el.kind === 'section' && el.node === 'features-1');
    expect(error(callsToSteps([style([section.id], { boxShadow: 'lg' })], index.handles, CTX))).toContain("use ck.tool('theme.apply'");
  });

  it('set {text} on a card holding several texts → E_BAD_TARGET', () => {
    const card = find(index, (el) => el.part === 'item');
    expect(error(callsToSteps([set([card.id], { text: 'x' })], index.handles, CTX))).toContain('holds several texts');
  });
});

describe('callsToSteps — tools, keys and pages', () => {
  const index = indexOf(arabicKernel());

  it('a tool call passes through verbatim after its own parse', () => {
    const call = { n: 1, line: 1, op: 'tool', name: 'copy.set', input: { edits: [{ find: 'بُن', text: 'بن' }] } } as ScriptCall;
    expect(steps(callsToSteps([call], index.handles, CTX))).toEqual([
      { command: 'tool', args: { name: 'copy.set', input: { edits: [{ find: 'بُن', text: 'بن' }] } } },
    ]);
  });

  it('a tool input its parser refuses → E_TOOL_INPUT with the call number and line', () => {
    const call = { n: 4, line: 9, op: 'tool', name: 'part.list', input: { id: 'features-1' } } as ScriptCall;
    expect(error(callsToSteps([call], index.handles, CTX))).toMatch(/^E_TOOL_INPUT call #4 \(line 9\) tool "part\.list": /u);
  });

  it('a tool outside the lane → E_NO_TOOL with did-you-mean', () => {
    const lane = { ...CTX, tools: scriptToolNames(['section']) };
    const call = { n: 2, line: 5, op: 'tool', name: 'kit.insert', input: {} } as ScriptCall;
    expect(error(callsToSteps([call], index.handles, lane))).toMatch(/^E_NO_TOOL call #2 \(line 5\): no tool "kit\.insert" here\. Tools: .*kit\.section/u);
    const typo = { n: 1, line: 2, op: 'tool', name: 'element.styl', input: {} } as ScriptCall;
    expect(error(callsToSteps([typo], index.handles, lane))).toContain('Did you mean "element.style"?');
  });

  it('a write to another page without a site → E_OTHER_PAGE', () => {
    const call = { n: 1, line: 1, op: 'tool', name: 'nav.sync', input: {}, page: 'about' } as ScriptCall;
    expect(error(callsToSteps([call], index.handles, CTX))).toContain('E_OTHER_PAGE: this edit can only change the open page (page "page")');
  });

  it('with a site, steps are grouped by page', () => {
    const call = { n: 1, line: 1, op: 'tool', name: 'nav.sync', input: {}, page: 'about' } as ScriptCall;
    const site = { ...CTX, site: true, pages: [{ id: 'about', title: 'About', slug: 'about', lang: 'ar', dir: 'rtl' as const, current: false }] };
    const result = callsToSteps([call], index.handles, site);
    expect(result.ok && [...result.byPage.keys()]).toEqual(['about']);
  });

  it('an unknown style key → E_TOOL_INPUT listing the nearest ids', () => {
    const h1 = find(index, (el) => el.tag === 'h1');
    expect(error(callsToSteps([style([h1.id], { fontsize: '2xl', roundness: 'full' })], index.handles, CTX))).toMatch(
      /^E_TOOL_INPUT call #1 \(line 4\) tool "element\.style": unknown style "roundness"; nearest: /u,
    );
  });
});

describe('style keys', () => {
  it('folds kebab-case and the common CSS names onto the vocabulary', () => {
    expect(camelStyleKey('font-size')).toBe('fontSize');
    const read = (key: string) => {
      const result = normalizeStyleKey(key);
      return result.ok ? result.property : result.error;
    };
    expect(['border-radius', 'radius', 'color', 'background', 'background-color', 'bg', 'width', 'height', 'min-height', 'max-width', 'shadow', 'font-weight', 'box-shadow', 'fontsize'].map(read)).toEqual([
      'borderRadius',
      'borderRadius',
      'textColor',
      'backgroundColor',
      'backgroundColor',
      'backgroundColor',
      'inlineSize',
      'blockSize',
      'minBlockSize',
      'maxInlineSize',
      'boxShadow',
      'fontWeight',
      'boxShadow',
      'fontSize',
    ]);
    expect(read('borderRadious')).toContain('nearest: borderRadius');
    expect(nearestStyleKeys('paddng')[0]).toBe('padding');
  });
});
