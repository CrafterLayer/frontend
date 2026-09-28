/**
 * A smoke test for the specimen, plus the guards that keep its evidence true: the byte
 * counts it (and its docs page) print are the files on disk, and the six stylesheets the
 * product loads are the six the specimen documents. A specimen whose numbers drifted from
 * the files would be worse than none.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TypeSpecimen } from './TypeSpecimen';
import { FONT_FILES, TYPE_ROLES, formatBytes } from './TypeSpecimen.data';

const HERE = join(process.cwd(), 'src', 'features', 'agent', 'components', 'TypeSpecimen');
const read = (...parts: string[]): string => readFileSync(join(...parts), 'utf8');

/** Every `import '…css'` specifier in a source file, in order. */
function cssImports(source: string): string[] {
  return [...source.matchAll(/^import '(@fontsource\/[^']+\.css)';$/gm)].map(
    (match) => match[1] ?? '',
  );
}

describe('TypeSpecimen', () => {
  it('shows every SPEC §2.2 role in Latin and in Arabic', () => {
    render(<TypeSpecimen />);
    const roles = screen.getByRole('list', { name: 'Roles' });
    const items = within(roles).getAllByRole('listitem');
    expect(items).toHaveLength(TYPE_ROLES.length);

    for (const [index, role] of TYPE_ROLES.entries()) {
      const item = items[index];
      if (item === undefined) throw new Error(`no row for ${role.key}`);
      expect(item).toHaveAttribute('data-role', role.key);
      const latin = within(item).getByText(role.sample.en);
      const arabic = within(item).getByText(role.sample.ar);
      expect(latin).toHaveAttribute('lang', 'en');
      expect(latin).toHaveAttribute('dir', 'ltr');
      expect(arabic).toHaveAttribute('lang', 'ar');
      expect(arabic).toHaveAttribute('dir', 'rtl');
      // Size and weight come from the stylesheet, keyed on the role, never inline.
      expect(latin).toHaveAttribute('data-role', role.key);
      expect(latin).not.toHaveAttribute('style');
    }
  });

  it('lists the six files with their measured sizes and the total', () => {
    render(<TypeSpecimen />);
    const table = screen.getByRole('table', { name: /six files/i });
    const rows = within(table).getAllByRole('row');
    // Header, six files, total.
    expect(rows).toHaveLength(8);
    for (const file of FONT_FILES) {
      expect(within(table).getByText(file.file)).toBeInTheDocument();
    }
    const total = FONT_FILES.reduce((sum, file) => sum + file.bytes, 0);
    expect(within(table).getByText(formatBytes(total))).toBeInTheDocument();
  });

  it.each([
    ['en', 'ltr', 'Roles'],
    ['ar', 'rtl', 'الأدوار'],
  ] as const)(
    'the root speaks the locale (%s), and Latin inside it says so',
    (locale, dir, roles) => {
      // The theme's Latin-island rule (`:lang(ar) [lang]:not(:lang(ar))`) re-points Latin
      // text inside Arabic, so the root takes the locale like the panel's own root will, and
      // the specimen renders the same inheritance the panel does.
      const { container } = render(<TypeSpecimen locale={locale} />);
      const root = container.querySelector('.ck-agent-specimen');
      expect(root).toHaveAttribute('lang', locale);
      expect(root).toHaveAttribute('dir', dir);
      // The specimen's own words inherit the root's language instead of restating it.
      expect(screen.getByRole('heading', { name: roles })).not.toHaveAttribute('lang');

      // Every Latin-only string names its language, so it is an island inside Arabic and a
      // screen reader reads it in an English voice.
      const table = screen.getByRole('table', { name: /six files|الملفات الستة/ });
      const latinOnly = [
        ...within(table).getAllByText(/^IBM Plex Sans( Arabic)?$/),
        ...FONT_FILES.map((file) => within(table).getByText(file.file)),
      ];
      for (const element of latinOnly) {
        expect(element.closest('[lang]'), element.textContent).toHaveAttribute('lang', 'en');
      }
    },
  );

  it('sets each figure group in a Latin line and in an Arabic line', () => {
    render(<TypeSpecimen />);
    const figures = screen.getByRole('table', { name: /figures/i });
    for (const cell of within(figures).getAllByRole('cell')) {
      // The cell follows the table's direction, so both columns align the same way;
      // the script lives on the figure inside it.
      expect(cell).not.toHaveAttribute('dir');
    }
    const rows = within(figures).getAllByRole('row').slice(1);
    for (const row of rows) {
      const [latin, arabic] = within(row)
        .getAllByRole('cell')
        .map((cell) => cell.firstElementChild);
      expect(latin).toHaveAttribute('lang', 'en');
      expect(latin).toHaveAttribute('dir', 'ltr');
      expect(arabic).toHaveAttribute('lang', 'ar');
      expect(arabic).toHaveAttribute('dir', 'rtl');
    }
  });
});

describe('TypeSpecimen evidence stays true', () => {
  it('each recorded byte count is the woff2 file on disk', () => {
    for (const file of FONT_FILES) {
      const path = join(process.cwd(), 'node_modules', file.packageName, 'files', file.file);
      expect(statSync(path).size, file.file).toBe(file.bytes);
    }
  });

  it('each stylesheet points at the recorded woff2 and nothing else', () => {
    for (const file of FONT_FILES) {
      const css = read(process.cwd(), 'node_modules', `${file.packageName}/${file.stylesheet}`);
      expect(css).toContain(`./files/${file.file}`);
      expect(css).toContain(`font-weight: ${String(file.weight)};`);
      expect(css.match(/@font-face/g)).toHaveLength(1);
    }
  });

  it('main.tsx loads exactly the six documented stylesheets', () => {
    const main = read(process.cwd(), 'src', 'main.tsx');
    expect(cssImports(main)).toEqual(FONT_FILES.map((file) => file.specifier));
  });

  it('the stories load the same six, so Storybook renders the real faces', () => {
    const stories = read(HERE, 'TypeSpecimen.stories.tsx');
    expect(cssImports(stories)).toEqual(FONT_FILES.map((file) => file.specifier));
  });

  it('the docs page records the same byte counts', () => {
    const docs = read(HERE, 'TypeSpecimen.docs.mdx');
    for (const file of FONT_FILES) {
      const row = docs.split('\n').find((line) => line.includes(file.file));
      expect(row, file.file).toBeDefined();
      expect(row).toContain(file.bytes.toLocaleString('en-US'));
    }
  });

  it('the totals written as prose are the sums of the recorded files', () => {
    // Hand-added totals drifted once already (70,024 was written for a 71,024 sum), and
    // no other gate reads a sentence.
    const sum = (subset: 'latin' | 'arabic'): number =>
      FONT_FILES.filter((file) => file.subset === subset).reduce((all, f) => all + f.bytes, 0);
    const latin = sum('latin');
    const arabic = sum('arabic');
    // Prettier re-wraps prose, so compare with every run of whitespace as one space.
    const flat = (text: string): string => text.replace(/\s+/g, ' ');
    const docs = flat(read(HERE, 'TypeSpecimen.docs.mdx'));
    expect(docs).toContain(`**${formatBytes(latin)}** of Latin`);
    expect(docs).toContain(`**${formatBytes(arabic)}** of Arabic`);
    expect(docs).toContain(`**${formatBytes(latin + arabic)}** in all`);
    const main = flat(read(process.cwd(), 'src', 'main.tsx')).replace(/ \/\/ /g, ' ');
    expect(main).toContain(`${latin.toLocaleString('en-US')} B of Latin`);
    expect(main).toContain(`${arabic.toLocaleString('en-US')} B of Arabic`);
  });

  it('the stylesheet uses tokens and logical properties only', () => {
    const css = read(HERE, 'TypeSpecimen.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(css).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m,
    );
    expect(css).not.toMatch(/text-align:\s*(left|right)/);
    expect(css).not.toMatch(/letter-spacing/);
  });
});
