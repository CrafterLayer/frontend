import { describe, expect, it } from 'vitest';

import { BuilderError, builderError, isBuilderError } from './errors';

describe('BuilderError', () => {
  it('carries code, path, and meta', () => {
    const error = builderError('doc/cycle', 'boom', ['nodes', 'a'], { members: ['a', 'b'] });
    expect(error).toBeInstanceOf(BuilderError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('doc/cycle');
    expect(error.message).toBe('boom');
    expect(error.path).toEqual(['nodes', 'a']);
    expect(error.meta).toEqual({ members: ['a', 'b'] });
  });

  it('guards with isBuilderError', () => {
    expect(isBuilderError(builderError('cmd/unknown', 'x'))).toBe(true);
    expect(isBuilderError(new Error('x'))).toBe(false);
    expect(isBuilderError(null)).toBe(false);
  });
});
