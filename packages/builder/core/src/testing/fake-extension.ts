import { z } from 'zod';

import {
  defineBlockSchema,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { defineCommand } from '../commands/define-command';

const NullRender: BlockRenderComponent = () => null;

/**
 * The B0 exit-test fixture (contracts §12): a properly TYPED trusted manifest —
 * no `as never` anywhere — contributing one block and one command.
 */
export const fakeExtension: TrustedExtensionManifest = {
  tier: 1,
  name: 'fake',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'fakeBox',
          description: 'Test block.',
          props: z.object({ label: z.string().default('x') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
    commands: {
      'fake.tag': defineCommand({
        args: z.strictObject({ id: z.string().min(1) }),
        run: (args) => (draft) => {
          const node = draft.nodes[args.id];
          if (node !== undefined) {
            node.props['label'] = 'tagged';
          }
        },
      }),
    },
    keymaps: [{ combo: 'mod+shift+t', command: 'fake.tag' }],
  },
};
