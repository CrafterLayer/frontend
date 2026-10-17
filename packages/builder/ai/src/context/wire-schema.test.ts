import { describe, expect, it } from 'vitest';

import { wirePropsSchema } from './wire-schema';

describe('wirePropsSchema — the catalog wording of a props schema', () => {
  const same = { type: 'string', maxLength: 2000 };
  const names = ['alt', 'href', 'id', 'role', 'src', 'title', 'width', 'height', 'data-ck-behavior'];
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 120 },
      seo: { type: 'object', properties: { keyword: { type: 'string' } }, additionalProperties: false },
      attributes: {
        type: 'object',
        properties: Object.fromEntries(names.map((name) => [name, same])),
        additionalProperties: false,
      },
    },
    required: ['title'],
    additionalProperties: false,
  };

  it('drops $schema, states shared property schemas once, and summarises seo', () => {
    const out = wirePropsSchema(schema) as Record<string, Record<string, Record<string, unknown>>>;
    expect(out).not.toHaveProperty('$schema');
    expect(out['properties']?.['attributes']).toEqual({
      type: 'object',
      propertyNames: { enum: names },
      additionalProperties: same,
    });
    expect(out['properties']?.['seo']?.['description']).toContain('seo.* tools');
    expect(out['properties']?.['title']).toEqual({ type: 'string', maxLength: 120 });
    expect(JSON.stringify(out).length).toBeLessThan(JSON.stringify(schema).length);
  });

  it('leaves an object whose properties differ, or that has required keys, as it is', () => {
    const mixed = {
      type: 'object',
      properties: Object.fromEntries(names.map((name, index) => [name, { type: 'string', maxLength: index }])),
      additionalProperties: false,
    };
    expect(wirePropsSchema(mixed)).toEqual(mixed);
    const required = { ...schema.properties.attributes, required: ['alt'] };
    expect(wirePropsSchema(required)).toEqual(required);
  });
});

// ── block-parts (2026-10-06) ──
describe('wirePropsSchema — partStyles stays off the wire (context budget fix)', () => {
  it('drops the partStyles record and keeps every other prop', () => {
    const schema = {
      type: 'object',
      properties: {
        heading: { type: 'string', maxLength: 120 },
        partStyles: {
          type: 'object',
          propertyNames: { type: 'string', pattern: '^[a-z]+$' },
          additionalProperties: { type: 'object', properties: { className: { type: 'string' } } },
        },
      },
      required: ['heading', 'partStyles'],
    };
    expect(wirePropsSchema(schema)).toEqual({
      type: 'object',
      properties: { heading: { type: 'string', maxLength: 120 } },
      required: ['heading'],
    });
  });
});
// ── /block-parts ──
