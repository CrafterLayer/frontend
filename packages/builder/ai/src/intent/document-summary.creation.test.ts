import { describe, expect, it } from 'vitest';

import { incidentOptions, SCENE } from '../agent/run-agent.incident-fixtures';
import { summarizeDocumentForIntent } from './document-summary';
import { routeIntent } from './route-intent';

describe('existing creative scene ownership', () => {
  it('preserves a real drawn scene whose DOM host contains only a heading', () => {
    const { kernel } = incidentOptions();
    for (const command of SCENE.commands) kernel.dispatch(command.command, command.args);
    const document = summarizeDocumentForIntent(kernel.getDocument());

    expect(document).toMatchObject({ nodeCount: 1, placeholderOnly: false });
    expect(
      routeIntent({ request: 'Create a mural and change its night lighting', document }),
    ).toMatchObject({ kind: 'edit' });
    expect(routeIntent({ request: 'Add a new mural', document })).toMatchObject({
      kind: 'add-section',
      target: 'append',
    });
  });

  it('preserves a closed scene hosted in an otherwise empty shell', () => {
    const { kernel } = incidentOptions();
    kernel.dispatch('insertNode', {
      parentId: 'root',
      slot: 'default',
      type: 'customCode',
      props: {
        label: 'Scene',
        tree: {
          kind: 'root',
          children: [
            { kind: 'element', tag: 'section', attributes: { 'data-ck-scene': 'particles' } },
          ],
        },
      },
    });
    expect(summarizeDocumentForIntent(kernel.getDocument()).placeholderOnly).toBe(false);
  });
});
