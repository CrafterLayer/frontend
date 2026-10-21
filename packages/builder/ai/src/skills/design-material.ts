import fonts from 'open-props/src/fonts';
import sizes from 'open-props/src/sizes';

/** Select literal values, not the global stylesheet or a component/page template. */
function values(tokens: Readonly<Record<string, string>>, names: readonly string[]): string {
  return names
    .map((name) => {
      const value = tokens['--' + name];
      if (value === undefined || value.includes('var('))
        throw new Error('Design material needs a self-contained Open Props value: ' + name);
      return '--' + name + ':' + value;
    })
    .join('; ');
}

/** Real library material for planning, region writing and ordinary editing, with a fixed budget. */
export const DESIGN_MATERIAL_TEACHING = [
  'OPEN PROPS 1.7.23 (MIT), optional design material, not a template. Existing page tokens and explicit user choices win. Copy a chosen literal value into scoped CSS; --size-* / --font-* variables are NOT installed on the page. No npm/CDN import in a region.',
  'SPACE: ' +
    values(sizes, ['size-2', 'size-3', 'size-5', 'size-7', 'size-fluid-2', 'size-fluid-4']),
  'TYPE: ' +
    values(fonts, [
      'font-size-fluid-1',
      'font-size-fluid-2',
      'font-size-fluid-3',
      'font-lineheight-3',
    ]),
  'MEASURE: ' + values(sizes, ['size-content-2', 'size-header-2']),
  'Choose type, space, density and geometry together from the subject. Navigation may be compact, editorial, vertical, integrated or absent; a footer may be a colophon, contact-led or absent. Adapt to the current content, never rotate a fixed list. Reports prioritize a clear question, source/period, metric hierarchy, chart evidence and readable detail. Preserve real facts, keyboard access, logical RTL order and narrow-screen readability.',
].join('\n');
