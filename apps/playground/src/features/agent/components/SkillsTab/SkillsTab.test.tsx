/**
 * SkillsTab (2026-10-12): the person's own skills over the real stores (`useAgentKnowledge`
 * seeded from storage), so each assertion follows what the person sees after an action —
 * a new skill written, a SKILL.md imported (pasted, or fetched from a link to read first), an
 * unreadable one refused, a switch refused by
 * the every-request budget, a skill deleted or copied, .md and .mdx files uploaded, a
 * template added — and the built-ins behind a disclosure.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createCraftkitAiSkillRegistry } from '@craftkit/builder';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { Fetcher } from '../../model/skill-link';
import { skillTemplates, type SkillTemplate } from '../../model/skill-templates';
import type { UserSkill } from '../../model/user-skills';
import type { Locale } from '../../model/view-types';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR, seededStorage } from '../../testing/knowledge-fixtures';

import { SkillsTab } from './SkillsTab';

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');
const BUILT_IN_COUNT = createCraftkitAiSkillRegistry()
  .list()
  .filter((skill) => skill.source !== 'host').length;

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SkillsTab', 'SkillsTab.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

/** Two every-request skills that cannot both be on: 5000 + 4000 > the 8000 budget. */
const OVER_BUDGET: readonly UserSkill[] = [
  {
    id: 'user.skill-1',
    name: 'Long house style',
    description: '',
    instructions: 'a'.repeat(5_000),
    keywords: [],
    mode: 'always',
    enabled: true,
  },
  {
    id: 'user.skill-2',
    name: 'Long tone guide',
    description: '',
    instructions: 'b'.repeat(4_000),
    keywords: [],
    mode: 'always',
    enabled: false,
  },
];

const IMPORTED = [
  '---',
  'name: Booking band',
  'description: Every page',
  'keywords: booking, footer',
  'mode: always',
  '---',
  'End every page with the booking band.',
].join('\n');

/** A SKILL.mdx: imports and exports are not instructions; the meta object names the skill. */
const MDX = [
  "import { Callout } from './callout';",
  '',
  'export const meta = {',
  "  name: 'Tone of voice',",
  "  description: 'Every line of copy',",
  "  keywords: ['copy', 'headline'],",
  '};',
  '',
  '<Callout>Never use exclamation marks.</Callout>',
  '',
  'Write short, warm sentences.',
].join('\n');

interface LiveSkillsProps {
  readonly locale?: Locale;
  readonly skills?: readonly UserSkill[];
  readonly clipboard?: (text: string) => Promise<void>;
  readonly templates?: readonly SkillTemplate[];
  readonly fetcher?: Fetcher;
}

/** The tab over real stores, seeded as the browser would hold them. */
function LiveSkills({
  locale = 'en',
  skills = SAMPLE_SKILLS,
  clipboard,
  templates,
  fetcher,
}: LiveSkillsProps) {
  const [storage] = useState(() => seededStorage(skills));
  const { view } = useAgentKnowledge({ storage });
  return (
    <SkillsTab
      skills={view.skills}
      labels={knowledgeLabels(locale)}
      clipboard={clipboard}
      templates={templates}
      fetcher={fetcher}
    />
  );
}

function setup(props: LiveSkillsProps = {}) {
  render(<LiveSkills {...props} />);
  return userEvent.setup();
}

/** The person's own skills' switches (the default skills have theirs in their own section). */
function switches(): HTMLElement[] {
  return screen
    .queryAllByRole('switch')
    .filter((element) => element.closest('.ck-agent-defaults') === null);
}

/** The hidden file input behind "Upload .md or .mdx". */
function fileInput(locale: Locale = 'en'): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(knowledgeLabels(locale).upload.choose, {
    selector: 'input',
  });
}

function skillFile(name: string, text: string): File {
  return new File([text], name, { type: name.endsWith('.mdx') ? 'text/mdx' : 'text/markdown' });
}

describe('SkillsTab', () => {
  it("lists the person's skills, each with its switch, and counts them", () => {
    setup();
    expect(switches().map((element) => element.getAttribute('aria-label'))).toEqual([
      'Use Brand voice',
      'Use House style',
      'Use Seasonal menu',
    ]);
    expect(screen.getByText(EN.skills.intro)).toBeInTheDocument();
    expect(screen.getByText('3 of 24')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New skill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('makes a default skill the person’s own: a copy to edit, and the default switched off', async () => {
    const user = setup({ skills: [] });
    const defaults = screen.getByRole('region', { name: EN.defaults.title });
    await user.click(
      within(defaults).getByRole('button', { name: 'Make Forms people finish my own' }),
    );
    expect(screen.getByRole('heading', { name: 'New skill' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Forms people finish');
    expect(screen.getByDisplayValue(/FEWER FIELDS/u)).toBe(
      screen.getByRole('textbox', { name: 'Instructions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(switches()).toHaveLength(1);
    expect(switches()[0]).toHaveAccessibleName('Use Forms people finish');
    expect(
      within(screen.getByRole('region', { name: EN.defaults.title })).getByRole('switch', {
        name: 'Use Forms people finish',
      }),
    ).not.toBeChecked();
    expect(screen.getByText(EN.defaults.owned('Forms people finish'))).toBeInTheDocument();
  });

  it('writes a new skill: New skill opens the editor, Save adds the row', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'New skill' }));
    expect(screen.getByRole('heading', { name: 'New skill' })).toBeInTheDocument();
    expect(switches()).toHaveLength(0);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Booking band');
    await user.type(
      screen.getByRole('textbox', { name: 'Instructions' }),
      'End every page with the booking band.',
    );
    await user.type(screen.getByRole('textbox', { name: /^Words that turn it on/u }), 'booking');
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(screen.queryByRole('heading', { name: 'New skill' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Use Booking band' })).toBeChecked();
    expect(screen.getByText('4 of 24')).toBeInTheDocument();
  });

  it('keeps the editor open on a refusal, and Cancel returns to the list', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'New skill' }));
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(screen.getByRole('alert')).toHaveTextContent(EN.editor.refusals.name);
    expect(screen.getByRole('heading', { name: 'New skill' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(switches()).toHaveLength(3);
  });

  it('edits a skill in place', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Brand voice' }));
    expect(screen.getByRole('heading', { name: 'Edit skill' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Brand tone');
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(switches()[0]).toHaveAccessibleName('Use Brand tone');
    expect(screen.getByText('3 of 24')).toBeInTheDocument();
  });

  it('imports a pasted SKILL.md, reading its name and mode from the front matter', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const markdown = screen.getByRole('textbox', { name: EN.skills.importLabel });
    await user.click(markdown);
    await user.paste(IMPORTED);
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    const imported = screen.getByRole('switch', { name: 'Use Booking band' });
    expect(imported).toBeChecked();
    expect(imported.closest('li')).toHaveTextContent(EN.skills.always);
    expect(screen.getByText('4 of 24')).toBeInTheDocument();
  });

  it('imports a word-triggered SKILL.md with its keywords', async () => {
    const user = setup({ skills: [] });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('textbox', { name: EN.skills.importLabel }));
    await user.paste(IMPORTED.replace('mode: always', 'mode: auto'));
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    const row = screen.getByRole('switch', { name: 'Use Booking band' }).closest('li');
    expect(row).toHaveTextContent('When a request mentions booking, footer');
  });

  it('refuses a SKILL.md it cannot read, and stays on the import', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    expect(screen.getByRole('alert')).toHaveTextContent(EN.editor.refusals.unreadable);
    expect(screen.getByRole('textbox', { name: EN.skills.importLabel })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(switches()).toHaveLength(3);
  });

  it('fetches a link into the box to read first, then adds it', async () => {
    const asked: string[] = [];
    const fetcher: Fetcher = (url) => {
      asked.push(url);
      const response = new Response(IMPORTED, { headers: { 'content-type': 'text/plain' } });
      Object.defineProperty(response, 'url', { value: url });
      return Promise.resolve(response);
    };
    const user = setup({ skills: [], fetcher });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const box = screen.getByRole('textbox', { name: EN.skills.importLabel });
    await user.click(box);
    await user.paste('https://github.com/acme/skills/blob/main/booking/SKILL.md');
    await user.click(screen.getByRole('button', { name: EN.link.fetch }));
    expect(asked).toEqual(['https://raw.githubusercontent.com/acme/skills/main/booking/SKILL.md']);
    expect(box).toHaveValue(IMPORTED);
    expect(screen.getByRole('status')).toHaveTextContent(
      EN.link.fetched('raw.githubusercontent.com'),
    );
    expect(switches()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    expect(screen.getByRole('switch', { name: 'Use Booking band' })).toBeChecked();
  });

  it('says why a link gave no skill', async () => {
    const user = setup({ fetcher: () => Promise.resolve(new Response('', { status: 404 })) });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const box = screen.getByRole('textbox', { name: EN.skills.importLabel });
    await user.click(box);
    await user.paste('https://example.com/missing/SKILL.md');
    await user.click(screen.getByRole('button', { name: EN.link.fetch }));
    expect(await screen.findByRole('alert')).toHaveTextContent(EN.link.status(404));
    await user.clear(box);
    await user.paste('http://example.com/SKILL.md');
    await user.click(screen.getByRole('button', { name: EN.link.fetch }));
    expect(screen.getByRole('alert')).toHaveTextContent(EN.link.insecure);
  });

  it('lists the built-in skills behind a disclosure', async () => {
    const user = setup();
    expect(BUILT_IN_COUNT).toBeGreaterThan(0);
    const summary = screen.getByText(`Built-in skills (${String(BUILT_IN_COUNT)})`);
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    await user.click(summary);
    expect(details).toHaveAttribute('open');
    expect(within(details!).getByText(EN.skills.builtInsHint)).toBeInTheDocument();
    expect(within(details!).getAllByRole('listitem')).toHaveLength(BUILT_IN_COUNT);
    // It scrolls on its own, so it is a named tab stop a keyboard can scroll.
    const list = within(details!).getByRole('list', { name: summary.textContent });
    expect(list).toHaveAttribute('tabindex', '0');
  });

  it('refuses turning on an every-request skill past the budget', async () => {
    const user = setup({ skills: OVER_BUDGET });
    const second = screen.getByRole('switch', { name: 'Use Long tone guide' });
    await user.click(second);
    expect(screen.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
    expect(second).not.toBeChecked();
    // Turning the first off makes room.
    await user.click(screen.getByRole('switch', { name: 'Use Long house style' }));
    await user.click(second);
    expect(second).toBeChecked();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('turns a skill off and on', async () => {
    const user = setup();
    const brand = screen.getByRole('switch', { name: 'Use Brand voice' });
    await user.click(brand);
    expect(brand).not.toBeChecked();
    await user.click(brand);
    expect(brand).toBeChecked();
  });

  it('deletes a skill on the second press of Delete', async () => {
    const user = setup();
    const remove = screen.getByRole('button', { name: 'Delete Seasonal menu' });
    await user.click(remove);
    expect(switches()).toHaveLength(3);
    await user.click(remove);
    expect(screen.queryByRole('switch', { name: 'Use Seasonal menu' })).toBeNull();
    expect(screen.getByText('2 of 24')).toBeInTheDocument();
  });

  it('copies a skill as SKILL.md', async () => {
    const clipboard = vi.fn(() => Promise.resolve());
    const user = setup({ clipboard });
    await user.click(screen.getByRole('button', { name: 'Copy Brand voice as SKILL.md' }));
    expect(await screen.findByRole('button', { name: EN.skills.copied })).toBeInTheDocument();
    expect(clipboard).toHaveBeenCalledWith(expect.stringContaining('name: Brand voice'));
    expect(clipboard).toHaveBeenCalledWith(
      expect.stringContaining('keywords: copy, headline, button'),
    );
  });

  it('says so when the person has none of their own', () => {
    setup({ skills: [] });
    expect(screen.getByText(EN.skills.empty)).toBeInTheDocument();
    expect(switches()).toHaveLength(0);
    expect(screen.getByText('0 of 24')).toBeInTheDocument();
  });

  it('speaks Arabic: actions, rows, count and built-ins', async () => {
    const user = setup({ locale: 'ar', skills: SAMPLE_SKILLS_AR });
    expect(screen.getByRole('switch', { name: 'استخدم نبرة العلامة' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'استخدم أسلوب المنزل' })).toBeChecked();
    expect(screen.getByText('2 من 24')).toBeInTheDocument();
    expect(screen.getByText(`المهارات المدمجة (${String(BUILT_IN_COUNT)})`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'استيراد' }));
    await user.click(screen.getByRole('button', { name: AR.skills.importSave }));
    expect(screen.getByRole('alert')).toHaveTextContent(AR.editor.refusals.unreadable);
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    await user.click(screen.getByRole('button', { name: 'مهارة جديدة' }));
    expect(screen.getByRole('heading', { name: 'مهارة جديدة' })).toBeInTheDocument();
  });

  /* ── Upload ─────────────────────────────────────────────────────────────── */

  it('Upload opens a multi-file picker for Markdown and MDX', async () => {
    const user = setup();
    const input = fileInput();
    expect(input).toHaveAttribute('multiple');
    expect(input.accept.split(',')).toEqual(expect.arrayContaining(['.md', '.mdx']));
    const picked = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Upload .md or .mdx' }));
    expect(picked).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('imports every uploaded .md and .mdx file, and says how many came in', async () => {
    const user = setup();
    await user.upload(fileInput(), [
      skillFile('tone.mdx', MDX),
      skillFile('booking.md', IMPORTED.replace('mode: always', 'mode: auto')),
    ]);
    expect(await screen.findByText('2 skills imported.')).toBe(screen.getByRole('status'));
    const tone = screen.getByRole('switch', { name: 'Use Tone of voice' });
    expect(tone.closest('li')).toHaveTextContent('When a request mentions copy, headline');
    expect(screen.getByRole('switch', { name: 'Use Booking band' })).toBeChecked();
    expect(screen.getByText('5 of 24')).toBeInTheDocument();
    // The MDX's JSX was unwrapped to its words, its import and export left out.
    await user.click(screen.getByRole('button', { name: 'Edit Tone of voice' }));
    const instructions = screen.getByRole('textbox', { name: 'Instructions' });
    expect(instructions).toHaveValue(
      'Never use exclamation marks.\n\nWrite short, warm sentences.',
    );
  });

  it('names each file it could not read, beside what it did import', async () => {
    const user = setup();
    await user.upload(fileInput(), [
      skillFile('tone.mdx', MDX),
      skillFile('broken.md', '   \n'),
      skillFile('nameless.md', '---\ndescription: no name\n---\nSome instructions.'),
    ]);
    const status = await screen.findByRole('status');
    await vi.waitFor(() => {
      expect(status).toHaveTextContent(
        `1 skill imported. broken.md: ${EN.editor.refusals.unreadable} nameless.md: ${EN.editor.refusals.name}`,
      );
    });
    expect(switches()).toHaveLength(4);
  });

  it('says so in Arabic', async () => {
    const user = setup({ locale: 'ar', skills: SAMPLE_SKILLS_AR });
    await user.upload(fileInput('ar'), [
      skillFile('tone.mdx', MDX),
      skillFile('booking.md', IMPORTED),
    ]);
    expect(await screen.findByText(AR.upload.imported(2))).toBe(screen.getByRole('status'));
    expect(screen.getByRole('button', { name: AR.upload.choose })).toBeInTheDocument();
  });

  /* ── Templates ──────────────────────────────────────────────────────────── */

  it('adds a template in one press, says so, and stops offering it', async () => {
    const user = setup({ templates: skillTemplates('en') });
    const summary = screen.getByText(EN.templates.title);
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    const add = screen.getByRole('button', { name: 'Add Accessible by default' });
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent(
      EN.templates.added('Accessible by default'),
    );
    expect(screen.getByRole('switch', { name: 'Use Accessible by default' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Add Accessible by default' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Add /u })).toHaveLength(
      skillTemplates('en').length - 1,
    );
  });

  it('hides a template the person already keeps by name', () => {
    const [accessible] = skillTemplates('en');
    setup({
      templates: skillTemplates('en'),
      skills: [{ ...SAMPLE_SKILLS[0]!, name: accessible!.draft.name }],
    });
    expect(screen.queryByRole('button', { name: `Add ${accessible!.draft.name}` })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Search-ready pages' })).toBeInTheDocument();
  });

  it('draws no template disclosure without templates', () => {
    setup();
    expect(screen.queryByText(EN.templates.title)).toBeNull();
  });

  it('offers the Arabic templates in Arabic', async () => {
    const user = setup({ locale: 'ar', skills: SAMPLE_SKILLS_AR, templates: skillTemplates('ar') });
    const [first] = skillTemplates('ar');
    await user.click(screen.getByText(AR.templates.title));
    await user.click(screen.getByRole('button', { name: AR.templates.add(first!.draft.name) }));
    expect(screen.getByRole('status')).toHaveTextContent(AR.templates.added(first!.draft.name));
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
