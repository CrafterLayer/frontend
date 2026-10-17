import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { RegisterDemoExtension } from './RegisterDemoExtension';

describe('RegisterDemoExtension (SC-005)', () => {
  it('registers at runtime, inserts an announcement, and can dispose again', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    render(<RegisterDemoExtension kernel={kernel} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Register demo extension' }));
    expect(kernel.extensions.has('playground-demo')).toBe(true);
    const doc = kernel.getDocument();
    const firstChild = doc.nodes[doc.rootId]?.slots?.['default']?.[0];
    expect(firstChild).toBeDefined();
    expect(doc.nodes[firstChild ?? '']?.type).toBe('announcement');

    await user.click(screen.getByRole('button', { name: 'Dispose demo extension' }));
    expect(kernel.extensions.has('playground-demo')).toBe(false);
    // The document still holds the node; only its renderer is gone (fallback shows).
    expect(kernel.getDocument().nodes[firstChild ?? '']?.type).toBe('announcement');
  });
});
