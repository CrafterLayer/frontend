import { describe, expect, it } from 'vitest';

import { richTextExtension } from './index';

describe('richTextExtension', () => {
  it('loads the inline editor module only when the registry requests that contribution', async () => {
    const inlineEditor = richTextExtension.contributes?.inlineEditors?.[0];
    if (inlineEditor === undefined) {
      throw new Error('The rich text extension must contribute an inline editor');
    }

    expect(inlineEditor.kind).toBe('rich');
    const module = await inlineEditor.load();
    expect(module.default).toEqual(expect.any(Function));
  });
});
