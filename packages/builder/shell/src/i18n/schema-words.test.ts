import { describe, expect, it } from 'vitest';

import { SCHEMA_NAMES_AR, SCHEMA_OPTIONS_AR, schemaName, schemaOption, schemaWordKey } from './schema-words';

const LATIN_LETTER = /[A-Za-z]/u;

describe('schema words', () => {
  it('keys a word the way the schema spells it in any case or separator', () => {
    expect(schemaWordKey('trustLine')).toBe('trustline');
    expect(schemaWordKey('Trust line')).toBe('trustline');
    expect(schemaWordKey('Padding & margin')).toBe('paddingmargin');
  });

  it('names the hero and form fields in Arabic, and keeps English unchanged', () => {
    for (const [key, english] of [
      ['eyebrow', 'Eyebrow'],
      ['heading', 'Heading'],
      ['body', 'Body'],
      ['trustLine', 'Trust line'],
      ['align', 'Align'],
      ['tone', 'Tone'],
      ['spacing', 'Spacing'],
      ['width', 'Width'],
      ['introduction', 'Introduction'],
      ['fields', 'Fields'],
      ['id', 'Id'],
      ['name', 'Name'],
      ['type', 'Type'],
      ['label', 'Label'],
      ['placeholder', 'Placeholder'],
      ['helper', 'Helper'],
      ['autoComplete', 'Auto complete'],
    ] as const) {
      expect(schemaName(key, 'en', english)).toBe(english);
      expect(schemaName(key, 'ar', english)).not.toMatch(LATIN_LETTER);
    }
    expect(schemaName('Text', 'ar')).toBe('النص');
    expect(schemaName('Content', 'ar')).toBe('المحتوى');
  });

  it('keeps a word it does not know in English rather than inventing one', () => {
    expect(schemaName('zzUnknown', 'ar', 'Zz unknown')).toBe('Zz unknown');
    expect(schemaOption('3', 'ar')).toBe('3');
  });

  it('lists options in Arabic: transparent, lg, full', () => {
    expect(schemaOption('transparent', 'ar')).toBe('شفاف');
    expect(schemaOption('lg', 'ar')).toBe('كبير');
    expect(schemaOption('full', 'ar')).toBe('كامل');
    expect(schemaOption('lg', 'en')).toBe('lg');
  });

  it('holds only Arabic words (CSS is the one term kept as written)', () => {
    for (const word of [...Object.values(SCHEMA_NAMES_AR), ...Object.values(SCHEMA_OPTIONS_AR)]) {
      expect(word.replace(/CSS|Esc/gu, '')).not.toMatch(LATIN_LETTER);
    }
  });
});
