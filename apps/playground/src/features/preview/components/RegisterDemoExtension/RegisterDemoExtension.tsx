import { useState } from 'react';

import { insertedNodeId, type BuilderKernel } from '@craftkit/builder';

import { demoExtension } from '../../demo-extension';

export interface RegisterDemoExtensionProps {
  kernel: BuilderKernel;
}

/**
 * The FR-013 demo: registers the announcement extension AT RUNTIME, inserts one
 * announcement through an ordinary command, and can dispose it again — the block
 * on screen then downgrades to the explicit fallback. No reloads anywhere.
 */
export function RegisterDemoExtension({ kernel }: RegisterDemoExtensionProps) {
  const [registered, setRegistered] = useState(() => kernel.extensions.has(demoExtension.name));

  if (registered) {
    return (
      <button
        type="button"
        onClick={() => {
          kernel.extensions.dispose(demoExtension.name);
          setRegistered(false);
        }}
      >
        Dispose demo extension
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        kernel.extensions.register(demoExtension);
        const tx = kernel.dispatch('insertNode', {
          type: 'announcement',
          parentId: kernel.getDocument().rootId,
          index: 0,
        });
        setRegistered(insertedNodeId(tx.patches) !== undefined);
      }}
      /* Short on screen, whole in the accessible name — the bar is 56px and the
         harness must not push the product's controls out of it. */
      aria-label="Register demo extension"
    >
      Demo ext
    </button>
  );
}
