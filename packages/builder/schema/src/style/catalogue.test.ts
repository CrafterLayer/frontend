import { describe, expect, it } from 'vitest';

import {
  quickBarProperties,
  STYLE_PROPERTIES,
  STYLE_PROPERTY_IDS,
  STYLE_SECTORS,
  styleSidesOf,
} from './catalogue';
import { matchUtility } from './codec';

describe('STYLE_SECTORS — the §A.4 catalogue as data', () => {
  it('lists every property exactly once, in a sector of its own name', () => {
    const listed = STYLE_SECTORS.flatMap((sector) =>
      sector.properties.map((property) => property.id),
    );
    expect(listed).toEqual([...STYLE_PROPERTY_IDS]);
    for (const sector of STYLE_SECTORS) {
      for (const property of sector.properties) expect(property.sector).toBe(sector.id);
    }
  });

  it('labels every sector, property and offered option in English and Arabic', () => {
    for (const sector of STYLE_SECTORS) {
      expect(sector.labels.en).not.toBe('');
      expect(sector.labels.ar).toMatch(/[؀-ۿ]/u);
      for (const property of sector.properties) {
        expect(property.labels.en, property.id).not.toBe('');
        expect(property.labels.ar, property.id).toMatch(/[؀-ۿ]/u);
        for (const option of property.options ?? []) {
          if (option.legacy === true) continue;
          expect(option.labels?.ar, `${property.id}.${option.value}`).toMatch(/[؀-ۿ]/u);
        }
      }
    }
  });

  it('says start and end, never left and right, in offered labels of logical controls', () => {
    const logical = [
      'textAlign',
      'justifyContent',
      'alignItems',
      'alignSelf',
      'gradientDirection',
    ] as const;
    for (const id of logical) {
      for (const option of STYLE_PROPERTIES[id].options ?? []) {
        if (option.legacy === true) continue;
        expect(option.labels?.en ?? '', `${id}.${option.value}`).not.toMatch(/\b(left|right)\b/iu);
      }
    }
  });

  it('gives every class property a way to write a value', () => {
    for (const id of STYLE_PROPERTY_IDS) {
      const def = STYLE_PROPERTIES[id];
      if (def.storage === 'attribute') {
        expect(def.attribute, id).toBeDefined();
        continue;
      }
      const writable =
        def.prefix !== undefined ||
        def.sidePrefixes !== undefined ||
        (def.options?.length ?? 0) > 0;
      expect(writable, id).toBe(true);
    }
  });

  it('reads every option class back as its own property and value', () => {
    for (const id of STYLE_PROPERTY_IDS) {
      const def = STYLE_PROPERTIES[id];
      if (def.storage !== 'class') continue;
      for (const option of def.options ?? []) {
        const [main] = option.className.split(' ');
        expect(matchUtility(main ?? ''), `${id}.${option.value}`).toEqual([
          { property: id, value: { kind: 'keyword', keyword: option.value } },
        ]);
      }
    }
  });

  it('offers logical sides only', () => {
    expect(styleSidesOf('padding')).toEqual([
      'all',
      'block',
      'inline',
      'block-start',
      'block-end',
      'inline-start',
      'inline-end',
    ]);
    expect(styleSidesOf('borderRadius')).toContain('end-end');
    expect(styleSidesOf('opacity')).toEqual([]);
  });

  it('puts the owner’s quick controls on the quick bars (§A.6)', () => {
    const ids = (kind: Parameters<typeof quickBarProperties>[0]): string[] =>
      quickBarProperties(kind).map((def) => def.id);
    expect(ids('text')).toEqual(
      expect.arrayContaining([
        'fontSize',
        'fontWeight',
        'textColor',
        'textAlign',
        'lineHeight',
        'direction',
      ]),
    );
    expect(ids('container')).toEqual(
      expect.arrayContaining([
        'backgroundColor',
        'padding',
        'gap',
        'flexDirection',
        'alignItems',
        'justifyContent',
        'borderRadius',
        'borderWidth',
        'boxShadow',
      ]),
    );
    expect(ids('media')).toEqual(
      expect.arrayContaining(['objectFit', 'borderRadius', 'aspectRatio']),
    );
    expect(ids('icon')).toContain('textColor');
    expect(ids('link')).toEqual(expect.arrayContaining(['textColor', 'hoverMotion']));
  });
});
