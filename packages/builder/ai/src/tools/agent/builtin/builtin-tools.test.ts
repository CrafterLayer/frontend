import { describe, expect, it } from 'vitest';

import { serializeTreeMarkup } from '../../../plan/tree-markup';
import {
  CAFE_PHOTO,
  expandAndValidate,
  fixtureKernel,
  liveContext,
} from '../agent-tools.fixtures';
import { ratio, readPageKit } from '../page-kit';
import { behaviorAttachTool } from './behavior-attach';
import { copySetTool } from './copy-set';
import { directionSetTool, logicalClassName, mirroredIcon } from './direction-set';
import { fontsSetTool } from './fonts-set';
import { iconSetTool } from './icon-set';
import { imageSetTool } from './image-set';
import { navSyncTool } from './nav-sync';
import { sectionOpsTool } from './section-ops';
import { themeApplyTool } from './theme-apply';

/** The step values an accepted plan writes, by `<id>.<key>`. */
function writes(result: ReturnType<typeof expandAndValidate>): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (result.result?.ok !== true) return out;
  for (const step of result.result.plan.commands) {
    const args = step.args as { id?: string; key?: string; value?: unknown };
    if (step.command === 'setProp') out.set(`${args.id ?? ''}.${args.key ?? ''}`, args.value);
    else out.set(step.command, step.args);
  }
  return out;
}

function markup(value: unknown): string {
  return serializeTreeMarkup(value) ?? '';
}

describe('theme.apply', () => {
  it('rejects input it cannot read', () => {
    expect(themeApplyTool.parse({}).ok).toBe(false);
    expect(themeApplyTool.parse({ accent: 'not-a-colour' }).ok).toBe(false);
    expect(themeApplyTool.parse({ radius: 'huge' }).ok).toBe(false);
    expect(themeApplyTool.parse({ accent: '#123456', extra: 1 }).ok).toBe(false);
  });

  it('recolours the kit and the door accepts it; every derived pair clears AA', () => {
    const kernel = fixtureKernel();
    const result = expandAndValidate(kernel, 'theme.apply', { accent: 'emerald-700' });
    expect(result.issues).toEqual([]);
    const css = writes(result).get('root.pageCss') as string;
    expect(css).toContain('--ck-accent:#047857');
    const { state } = readPageKit(css, false);
    expect(ratio(state.colours.onAccent, state.colours.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(state.colours.accentInk, state.colours.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('writes a fresh kit when the page has none', () => {
    const kernel = fixtureKernel({ kit: false });
    const result = expandAndValidate(kernel, 'theme.apply', { accent: '#b91c1c' });
    expect(result.issues).toEqual([]);
    expect(writes(result).get('root.pageCss')).toContain('.ck-page-plan{');
  });

  it('refuses a named pair below AA and names a shade that passes', () => {
    const kernel = fixtureKernel();
    const run = themeApplyTool.run({ ink: 'stone-300', bg: 'white' }, liveContext(kernel));
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error).toMatch(/below WCAG AA 4\.5:1/u);
    expect(run.error).toMatch(/Use ink "stone-\d+"/u);
  });

  it('keeps an Arabic page RTL: its eyebrow drops tracking and its faces stay Arabic', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const result = expandAndValidate(kernel, 'theme.apply', { deckRow: 'cafe' });
    expect(result.issues).toEqual([]);
    const css = writes(result).get('root.pageCss') as string;
    expect(css).toContain("'Lalezar'");
    expect(css).not.toContain('text-transform:uppercase');
  });
});

describe('fonts.set', () => {
  it('rejects an unverified family', () => {
    const parsed = fontsSetTool.parse({ display: 'Comic Sans' });
    expect(parsed.ok).toBe(false);
    expect(fontsSetTool.parse({}).ok).toBe(false);
  });

  it('rebuilds the import from verified weights and the door accepts it', () => {
    const kernel = fixtureKernel();
    const result = expandAndValidate(kernel, 'fonts.set', { display: 'fraunces', body: 'DM Sans' });
    expect(result.issues).toEqual([]);
    const css = writes(result).get('root.pageCss') as string;
    expect(css).toContain('family=Fraunces:wght@600%3B700');
    expect(css).toContain("--ck-font-display:'Fraunces'");
    expect(css).toContain("--ck-font-body:'DM Sans'");
  });

  it('refuses a Latin-only face on an Arabic page and lists Arabic ones', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const result = expandAndValidate(kernel, 'fonts.set', { display: 'Fraunces' });
    expect(result.issues[0]).toMatch(/has no Arabic glyphs/u);
    const ok = expandAndValidate(kernel, 'fonts.set', { display: 'Lalezar' });
    expect(ok.issues).toEqual([]);
    // A one-weight face is imported bare: a weight it lacks would 400 the whole request.
    expect(writes(ok).get('root.pageCss')).toMatch(/family=Lalezar&/u);
  });
});

describe('copy.set', () => {
  it('rejects malformed edits', () => {
    expect(copySetTool.parse({ edits: [] }).ok).toBe(false);
    expect(copySetTool.parse({ edits: [{ find: 'x' }] }).ok).toBe(false);
  });

  it('changes one text node and nothing else', () => {
    const kernel = fixtureKernel();
    const result = expandAndValidate(kernel, 'copy.set', { edits: [{ find: 'Our story', text: 'Since the start' }] });
    expect(result.issues).toEqual([]);
    const tree = markup(writes(result).get('r-story.tree'));
    expect(tree).toContain(">Since the start</h2>");
    expect(tree).toContain("class='text-3xl'");
  });

  it('says when a text is missing or ambiguous', () => {
    const kernel = fixtureKernel();
    expect(expandAndValidate(kernel, 'copy.set', { edits: [{ find: 'Nope', text: 'x' }] }).issues[0]).toMatch(/was not found/u);
    // "Menu" is the footer's link and not a whole text anywhere else; "Espresso" once — make one twice.
    const twice = expandAndValidate(kernel, 'copy.set', {
      edits: [
        { find: 'Espresso', text: 'Latte' },
        { find: 'Latte', text: 'x' },
      ],
    });
    expect(twice.issues[0]).toMatch(/ambiguous/u);
  });

  it('keeps Arabic copy as written', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const result = expandAndValidate(kernel, 'copy.set', { edits: [{ find: 'قصتنا', text: 'حكايتنا مع القهوة' }], id: 'r-story' });
    expect(result.issues).toEqual([]);
    expect(markup(writes(result).get('r-story.tree'))).toContain('>حكايتنا مع القهوة</h2>');
  });
});

describe('direction.set', () => {
  it('rejects a bad language tag', () => {
    expect(directionSetTool.parse({ lang: 'arabic!' }).ok).toBe(false);
    expect(directionSetTool.parse({ lang: 'ar', dir: 'up' }).ok).toBe(false);
  });

  it('maps physical classes to generated logical twins and mirrors pointing icons', () => {
    expect(logicalClassName('md:text-left rounded-l-lg border-r pl-4 left-0')).toBe('md:text-start rounded-s-lg border-e ps-4 start-0');
    expect(mirroredIcon('arrow-right')).toBe('arrow-left');
    expect(mirroredIcon('chevrons-left')).toBe('chevrons-right');
    expect(mirroredIcon('coffee')).toBe('coffee');
  });

  it('turns an English page Arabic: dir, lang, logical classes, icons and Arabic faces', () => {
    const kernel = fixtureKernel();
    const result = expandAndValidate(kernel, 'direction.set', { lang: 'ar' });
    expect(result.issues).toEqual([]);
    const out = writes(result);
    expect(out.get('setDocMeta')).toEqual({ dir: 'rtl' });
    expect(out.get('root.lang')).toBe('ar');
    const hero = markup(out.get('r-hero.tree'));
    expect(hero).toContain('text-start');
    expect(hero).toContain('rounded-e-lg border-e');
    expect(hero).toContain("name='arrow-left'");
    expect(out.get('root.pageCss')).toContain("'Readex Pro'");
  });

  it('is a no-op on a page that already reads that way', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const run = directionSetTool.run({ lang: 'ar' }, liveContext(kernel));
    expect(run).toMatchObject({ ok: true, steps: [] });
  });
});

describe('image.set', () => {
  it('requires alt text', () => {
    expect(imageSetTool.parse({ id: 'r-hero', find: CAFE_PHOTO, subject: 'cafe' }).ok).toBe(false);
  });

  it('swaps in a catalog photo with its size and a srcset', () => {
    const kernel = fixtureKernel();
    const result = expandAndValidate(kernel, 'image.set', {
      id: 'r-hero',
      find: CAFE_PHOTO,
      subject: 'cafe',
      aspect: 'portrait',
      alt: 'Latte art poured into a cup',
    });
    expect(result.issues).toEqual([]);
    const hero = markup(writes(result).get('r-hero.tree'));
    expect(hero).not.toContain(CAFE_PHOTO.replaceAll('&', '&amp;'));
    expect(hero).toMatch(/width='\d+'/u);
    expect(hero).toContain('640w');
    // The catalog entry's own description, written from the picture, not the caller's words.
    expect(hero).not.toContain("alt='Latte art poured into a cup'");
    expect(hero).toMatch(/<img alt='[^']+'/u);
  });

  it('describes the photo in Arabic from its catalog entry and says when the src is not on the page', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const ok = expandAndValidate(kernel, 'image.set', { id: 'r-hero', find: CAFE_PHOTO, subject: 'قهوة', alt: 'فنجان قهوة عربية' });
    expect(ok.issues).toEqual([]);
    expect(markup(writes(ok).get('r-hero.tree'))).toMatch(/<img alt='[\u0600-\u06FF][^']*'/u);
    const missing = expandAndValidate(kernel, 'image.set', { id: 'r-hero', find: 'https://x.test/a.jpg', subject: 'cafe', alt: 'x' });
    expect(missing.issues[0]).toMatch(/has src/u);
  });
});

describe('icon.set', () => {
  it('rejects a name Lucide does not have', () => {
    expect(iconSetTool.parse({ id: 'r-menu', find: 'coffee', icon: 'not-an-icon-xyz' }).ok).toBe(false);
  });

  it('renames the icon and the door accepts it (RTL page too)', () => {
    const en = expandAndValidate(fixtureKernel(), 'icon.set', { id: 'r-menu', find: 'coffee', icon: 'cup-soda' });
    expect(en.issues).toEqual([]);
    expect(markup(writes(en).get('r-menu.tree'))).toContain("name='cup-soda'");
    const ar = expandAndValidate(fixtureKernel({ locale: 'ar' }), 'icon.set', { id: 'r-hero', find: 'arrow-left', icon: 'chevron-left' });
    expect(ar.issues).toEqual([]);
  });
});

describe('section.ops', () => {
  it('rejects a move without a destination', () => {
    expect(sectionOpsTool.parse({ op: 'move', id: 'r-menu' }).ok).toBe(false);
    expect(sectionOpsTool.parse({ op: 'shuffle', id: 'r-menu' }).ok).toBe(false);
  });

  it('moves, duplicates and removes with the kernel commands', () => {
    const kernel = fixtureKernel();
    const moved = expandAndValidate(kernel, 'section.ops', { op: 'move', id: 'r-story', to: 'before:r-menu' });
    expect(moved.issues).toEqual([]);
    expect(writes(moved).get('moveNode')).toEqual({ id: 'r-story', toParentId: 'root', toIndex: 2 });
    const copied = expandAndValidate(kernel, 'section.ops', { op: 'duplicate', id: 'r-story' });
    expect(copied.issues).toEqual([]);
    expect(JSON.stringify(writes(copied).get('insertNode'))).toContain('"story-2"');
    const removed = expandAndValidate(kernel, 'section.ops', { op: 'remove', id: 'r-story' });
    expect(removed.issues).toEqual([]);
  });

  it('names the sections when the id is wrong (Arabic page)', () => {
    const result = expandAndValidate(fixtureKernel({ locale: 'ar' }), 'section.ops', { op: 'remove', id: 'nope' });
    expect(result.issues[0]).toMatch(/sections: r-header/u);
  });
});

describe('nav.sync', () => {
  it('rejects input', () => {
    expect(navSyncTool.parse({ x: 1 }).ok).toBe(false);
  });

  it('rebuilds the header menu and the footer column from labelled sections', () => {
    const result = expandAndValidate(fixtureKernel(), 'nav.sync', {});
    expect(result.issues).toEqual([]);
    const header = markup(writes(result).get('r-header.tree'));
    expect(header).toContain(">Menu</a>");
    expect(header).toContain("href='#story'");
    expect(header).not.toContain('#gone');
    // The brand and the action button are not menu entries.
    expect(header).toContain("href='#top'");
    expect(header).toContain('>Order</a>');
    const footer = markup(writes(result).get('r-footer.tree'));
    expect(footer).toContain(">Story</a></li>");
  });

  it('uses the Arabic labels on an Arabic page', () => {
    const result = expandAndValidate(fixtureKernel({ locale: 'ar' }), 'nav.sync', {});
    expect(result.issues).toEqual([]);
    expect(markup(writes(result).get('r-header.tree'))).toContain('>قصتنا</a>');
  });
});

describe('behavior.attach', () => {
  it('rejects a behaviour outside the enum', () => {
    expect(behaviorAttachTool.parse({ id: 'r-menu', find: 'Espresso', behavior: 'explode' }).ok).toBe(false);
  });

  it('sets data-ck-behavior and params on the one element', () => {
    const result = expandAndValidate(fixtureKernel(), 'behavior.attach', { id: 'r-story', find: 'Since 1998.', behavior: 'reveal' });
    expect(result.issues).toEqual([]);
    expect(markup(writes(result).get('r-story.tree'))).toContain("data-ck-behavior='reveal'");
  });

  it('finds Arabic text exactly', () => {
    const result = expandAndValidate(fixtureKernel({ locale: 'ar' }), 'behavior.attach', {
      id: 'r-menu',
      find: 'إسبريسو',
      behavior: 'reveal',
    });
    expect(result.issues).toEqual([]);
  });
});
