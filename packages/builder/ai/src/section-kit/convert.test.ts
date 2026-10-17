import { describe, expect, it } from 'vitest';

import { convertUpstreamHtml, heroiconToLucide, toKitColourClasses, toLogicalClasses } from './convert-core';

/* The converter's pure transforms (scripts/section-kit/convert.mjs runs this same code). */

describe('section-kit converter', () => {
  it('turns physical sides into logical ones, keeping variants and signs', () => {
    expect(toLogicalClasses('ml-4 mr-2 pl-6 pr-3 md:text-left text-right')).toBe(
      'ms-4 me-2 ps-6 pe-3 md:text-start text-end',
    );
    expect(toLogicalClasses('-left-4 right-0 rounded-l-lg rounded-tr-xl border-l-2 border-r')).toBe(
      '-start-4 end-0 rounded-s-lg rounded-se-xl border-s-2 border-e',
    );
    expect(toLogicalClasses('size-5 rtl:-scale-x-100 rtl:text-right')).toBe('size-5 ck-flip');
    expect(toLogicalClasses('text-lg leading-relaxed space-x-4')).toBe('text-lg leading-relaxed space-x-4');
  });

  it('maps palette colours onto the page kit and drops state and dark twins', () => {
    expect(toKitColourClasses('text-gray-900 text-gray-600 text-indigo-600')).toBe('ck-ink ck-muted ck-accent-ink');
    expect(toKitColourClasses('bg-indigo-600 px-4 hover:bg-indigo-700 dark:bg-gray-900', 'a')).toBe('ck-btn px-4');
    expect(toKitColourClasses('bg-white border border-gray-200 ring-1 ring-gray-300')).toBe('ck-surface border ck-border ring-1');
    expect(toKitColourClasses('bg-gray-900 bg-teal-600')).toBe('ck-inverse ck-accent-fill');
  });

  it('recognises heroicons by path and leaves brand marks unmapped', () => {
    expect(heroiconToLucide('m4.5 12.75 6 6 9-13.5')).toBe('check');
    expect(heroiconToLucide('M19.5 8.25l-7.5 7.5-7.5-7.5')).toBe('chevron-down');
    expect(heroiconToLucide('M12.026 2C7.13295 1.99937')).toBeUndefined();
  });

  it('drafts a kit from upstream HTML: slots, icons, Alpine and forms converted', () => {
    const draft = convertUpstreamHtml(`<!doctype html><html><head><title>x</title></head><body>
      <section class="bg-white text-left">
        <h2 class="text-gray-900 ml-2">Hello</h2>
        <p class="text-gray-600">Lead copy</p>
        <a href="#" class="bg-indigo-600 text-white">Go</a>
        <img src="https://images.unsplash.com/x" alt="" class="rounded-l-lg" />
        <svg class="size-5 rtl:-scale-x-100"><path d="m4.5 12.75 6 6 9-13.5"/></svg>
        <div x-data="{ open: false }"><button @click="open = !open">Q</button><p x-show="open">A</p></div>
        <form><input type="email" /></form>
      </section></body></html>`);
    expect(draft.markup).toContain("<section class='ck-surface text-start'>");
    expect(draft.markup).toContain("<h2 class='ck-ink ms-2'>{{title}}</h2>");
    expect(draft.markup).toContain("<p class='ck-muted'>{{lead}}</p>");
    expect(draft.markup).toContain("<a class='ck-btn text-white' href='{{link.href}}'>{{link.label}}</a>");
    expect(draft.markup).toContain("src='{{image.src}}' alt='{{image.alt}}'");
    expect(draft.markup).toContain("<icon name='check' class='ck-flip' size='20'/>");
    expect(draft.markup).toContain('<details><summary>');
    expect(draft.markup).toContain("<ck-component type='formSection' props='{}'/>");
    expect(draft.markup).not.toContain('x-data');
    expect(draft.slots['title']).toEqual({ kind: 'text', max: 90, required: true });
    expect(draft.slots['image']).toEqual({ kind: 'image', required: true });
    expect(draft.notes.length).toBeGreaterThan(0);
  });
});
