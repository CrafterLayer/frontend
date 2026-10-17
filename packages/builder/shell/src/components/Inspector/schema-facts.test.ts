import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { effectiveValue, schemaDefault, schemaFacts } from './schema-facts';

describe('schemaDefault / effectiveValue', () => {
  it('returns the SAME reference across calls for array and object defaults', () => {
    const items = z.array(z.string()).default([]);
    const record = z.object({ a: z.string() }).default({ a: 'x' });
    expect(effectiveValue(undefined, items)).toBe(effectiveValue(undefined, items));
    expect(effectiveValue(undefined, record)).toBe(effectiveValue(undefined, record));
    expect(effectiveValue(undefined, items)).toEqual([]);
    expect(effectiveValue(undefined, record)).toEqual({ a: 'x' });
  });

  it('parses each schema exactly once', () => {
    const schema = z.number().default(4);
    const spy = vi.spyOn(schema, 'safeParse');
    expect(schemaDefault(schema)).toBe(4);
    expect(schemaDefault(schema)).toBe(4);
    expect(effectiveValue(undefined, schema)).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('prefers the stored value and answers undefined for a schema with no default', () => {
    const schema = z.string();
    expect(effectiveValue('kept', z.string().default('lost'))).toBe('kept');
    expect(effectiveValue(0, z.number().default(9))).toBe(0);
    expect(schemaDefault(schema)).toBeUndefined();
    expect(effectiveValue(undefined, schema)).toBeUndefined();
  });
});

describe('schemaFacts', () => {
  it('caches enum members and the segment kind per schema', () => {
    const align = z.enum(['start', 'center', 'end']).default('start');
    const first = schemaFacts(align);
    expect(first).toBe(schemaFacts(align));
    expect(first.enumOptions).toEqual(['start', 'center', 'end']);
    expect(first.segmentKind).toBe('alignment');
    expect(first.segmentOptions).toEqual(['start', 'center', 'end']);
  });

  it('needs at least three known members before it calls a set segmented', () => {
    expect(schemaFacts(z.enum(['start', 'end'])).segmentKind).toBeUndefined();
    expect(schemaFacts(z.enum(['start', 'end'])).segmentOptions).toEqual([]);
    expect(schemaFacts(z.enum(['start', 'center', 'weird'])).segmentKind).toBeUndefined();
    expect(schemaFacts(z.enum(['row', 'column', 'row-reverse'])).segmentKind).toBe('direction');
    expect(schemaFacts(z.string()).enumOptions).toEqual([]);
  });
});
