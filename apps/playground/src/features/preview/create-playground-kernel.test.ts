import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from './create-playground-kernel';

describe('createPlaygroundKernel', () => {
  it('boots the professional landing fixture as a valid document with all templates registered', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });

    expect(kernel.validate()).toEqual([]);
    expect(kernel.context.registry.compositions('site').map(({ id }) => id)).toEqual([
      'saas-launch',
      'creative-agency',
      'commerce-launch',
      'professional-services',
    ]);
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(
      expect.arrayContaining([
        'announcement',
        'aurora',
        'logos',
        'bento',
        'stats',
        'features',
        'pricing',
        'quotes',
        'faq',
        'newsletter',
      ]),
    );
  });

  it('inserts a complete registered template as one valid, undoable change', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    const before = structuredClone(kernel.getDocument());

    kernel.dispatch('insertComposition', {
      compositionId: 'saas-launch',
      parentId: 'root',
    });

    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.validate()).toEqual([]);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
  });
});
