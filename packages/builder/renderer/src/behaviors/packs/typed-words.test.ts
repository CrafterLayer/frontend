import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountTypedWords } from './typed-words';

function host(words: readonly string[], attrs = ''): HTMLElement {
  const kids = words.map((word, at) => `<span${at === 0 ? '' : ' hidden'}>${word}</span>`).join('');
  document.body.innerHTML = `<h1>We build <span data-ck-behavior="typed-words" ${attrs}>${kids}</span></h1>`;
  return document.querySelector('[data-ck-behavior]')!;
}

/** The typed span (aria-hidden) and the spoken list (visually hidden), as the pack adds them. */
const typedOf = (el: Element) => el.querySelector('[aria-hidden="true"]');
const spokenOf = (el: Element) => el.lastElementChild;

function reduceMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  reduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mountTypedWords', () => {
  it('hides the words, types into an aria-hidden span and reads the list once', () => {
    const el = host(['websites', 'shops', 'brands']);
    const dispose = mountTypedWords(document);
    for (const word of Array.from(el.querySelectorAll('span:not([aria-hidden])')).slice(0, 3))
      expect(word).toHaveAttribute('hidden');
    expect(typedOf(el)?.textContent).toBe('websites');
    expect((typedOf(el) as HTMLElement).style.borderInlineEnd).toMatch(/currentcolor/iu);
    expect(spokenOf(el)?.textContent).toBe('websites, shops, brands');
    expect((spokenOf(el) as HTMLElement).style.clipPath).toBe('inset(50%)');
    expect(document.querySelector('h1')?.textContent).toContain('websites, shops, brands');
    dispose();
  });

  it('erases, types the next word, and stops on the first word after two rounds', () => {
    const el = host(['ab', 'cd'], 'data-ck-speed="fast"');
    const dispose = mountTypedWords(document);
    const typed = typedOf(el) as HTMLElement;
    vi.advanceTimersByTime(1600);
    expect(typed.textContent).toBe('a');
    vi.advanceTimersByTime(23);
    expect(typed.textContent).toBe('\u200b');
    vi.advanceTimersByTime(300);
    expect(typed.textContent).toBe('c');
    vi.advanceTimersByTime(45);
    expect(typed.textContent).toBe('cd');
    vi.advanceTimersByTime(60_000);
    expect(typed.textContent).toBe('ab');
    expect(typed.style.borderInlineEnd).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    dispose();
  });

  it('steps by grapheme, so Arabic and emoji are never split', () => {
    const el = host(['مرحبا', '👩🏽‍💻'], 'data-ck-speed="fast"');
    const dispose = mountTypedWords(document);
    const typed = typedOf(el) as HTMLElement;
    vi.advanceTimersByTime(1600 + 23 * 5 + 300);
    expect(typed.textContent).toBe('👩🏽‍💻');
    dispose();
  });

  it('is the static first word under reduced motion and on the canvas', () => {
    reduceMotion(true);
    const el = host(['websites', 'shops']);
    const before = el.outerHTML;
    mountTypedWords(document)();
    expect(el.outerHTML).toBe(before);
    reduceMotion(false);
    const dispose = mountTypedWords(document, { interactive: false });
    expect(el.outerHTML).toBe(before);
    dispose();
  });

  it('holds the first word alone when the markup lost its hidden words', () => {
    reduceMotion(true);
    document.body.innerHTML =
      '<h1><span data-ck-behavior="typed-words"><span>websites</span><span>shops</span></span></h1>';
    const el = document.querySelector<HTMLElement>('[data-ck-behavior]')!;
    const dispose = mountTypedWords(document, { interactive: false });
    expect(Array.from(el.children).map((word) => word.hasAttribute('hidden'))).toEqual([
      false,
      true,
    ]);
    expect(el.children).toHaveLength(2);
    dispose();
    expect(Array.from(el.children).map((word) => word.hasAttribute('hidden'))).toEqual([
      false,
      false,
    ]);
  });

  it('needs two non-empty words', () => {
    const el = host(['only']);
    const before = el.outerHTML;
    const dispose = mountTypedWords(document);
    expect(el.outerHTML).toBe(before);
    dispose();
  });

  it('is idempotent and restores the markup on dispose', () => {
    const el = host(['websites', 'shops']);
    const before = el.outerHTML;
    const dispose = mountTypedWords(document);
    mountTypedWords(el)();
    expect(el.children).toHaveLength(4);
    dispose();
    dispose();
    expect(el.outerHTML).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ships only to a page that names it, within 1.6 kB gzip', () => {
    expect(pageBehaviorPacks('<span data-ck-behavior="typed-words">')).toContain(mountTypedWords);
    expect(pageBehaviorPacks('<span data-ck-motion="typewriter">')).not.toContain(mountTypedWords);
    expect(gzipSync(mountTypedWords.toString()).length).toBeLessThanOrEqual(1640);
  });
});
