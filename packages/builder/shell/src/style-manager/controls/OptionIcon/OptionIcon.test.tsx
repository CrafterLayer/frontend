import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { STYLE_PROPERTIES } from '@craftkit/builder-schema';

import { OptionIcon } from './OptionIcon';
import { OPTION_GLYPHS } from './option-glyphs';

afterEach(cleanup);

describe('OptionIcon', () => {
  it('draws a decorative glyph and marks inline-axis glyphs for mirroring', () => {
    const { container } = render(
      <div>
        <OptionIcon property="flexDirection" value="row" />
        <OptionIcon property="flexDirection" value="column" />
      </div>,
    );
    const [row, column] = Array.from(container.querySelectorAll('svg'));
    expect(row).toHaveAttribute('aria-hidden', 'true');
    expect(row).toHaveAttribute('data-mirror');
    expect(column).not.toHaveAttribute('data-mirror');
  });

  it('renders a text mark for typographic choices and nothing for an unknown option', () => {
    const { container } = render(
      <div>
        <OptionIcon property="textTransform" value="capitalize" />
        <OptionIcon property="display" value="contents" />
      </div>,
    );
    expect(container).toHaveTextContent('Aa');
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('only names properties and options the catalogue really has', () => {
    for (const key of Object.keys(OPTION_GLYPHS)) {
      const [property = '', value = ''] = key.split(':');
      if (property === 'bucket') continue;
      const def = STYLE_PROPERTIES[property as keyof typeof STYLE_PROPERTIES];
      expect(def, key).toBeDefined();
      expect(def.options?.map((option) => option.value), key).toContain(value);
    }
  });
});
