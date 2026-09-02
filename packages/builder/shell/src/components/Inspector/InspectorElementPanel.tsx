import type { BuilderKernel } from '@craftkit/builder-core';
import type { PaletteEntry } from '@craftkit/builder-renderer';
import {
  customCodeNodeAtPath,
  replaceCustomCodeNodeAtPath,
  type CustomCodePath,
  type NodeId,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot } from '../../custom-code/element-at';
import {
  customCodeElementSections,
  type CustomCodeElementField,
} from '../../custom-code/element-fields';
import type { FieldCommit, FieldCommitResult } from '../../fields/field-commit';
import { InspectorElementSection } from './InspectorElementSection';
import { InspectorEmptyState } from './InspectorEmptyState';
import { InspectorRowBody } from './InspectorRowBody';
import type { DocumentDirection } from './types';
import { usePropertyValue } from './use-property-value';

export interface InspectorElementPanelProps {
  readonly kernel: BuilderKernel;
  /** The region: the document node whose tree holds the element. */
  readonly nodeId: NodeId;
  /** The prop the tree lives in, found by its declaration. */
  readonly treeKey: string;
  readonly path: CustomCodePath;
  readonly palette: readonly PaletteEntry[];
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  readonly dir: DocumentDirection;
}

const ELEMENT_GONE = 'That element is no longer in this region.';

/**
 * The rows for ONE authored element inside a composed region (an `<img>`, a
 * heading, a button the assistant wrote). The region is one document node and
 * its tree is one prop, so every row here commits by rebuilding that prop:
 * read the tree as it IS, write the element at the path, one `setProp` — one
 * transaction, one undo, exactly as a block's own row (i2). Values render
 * from document truth (i3): the panel subscribes to the tree prop, so an undo
 * or an AI rewrite shows through, and an element that no longer exists says
 * so instead of editing a ghost.
 */
export function InspectorElementPanel({
  kernel,
  nodeId,
  treeKey,
  path,
  palette,
  catalogVersion,
  announce,
  dir,
}: InspectorElementPanelProps) {
  const { stored } = usePropertyValue(kernel, nodeId, treeKey, 'base');
  const element = customCodeNodeAtPath(stored, path);
  if (element === undefined) {
    return <InspectorEmptyState kind="element-gone" />;
  }

  const commitFor =
    (field: CustomCodeElementField): FieldCommit =>
    (next): FieldCommitResult => {
      // Kernel truth at commit time, never the render's closure: two rows can
      // commit in one blur/click sequence, and the second must build on the
      // first's tree, not on the tree both were rendered from.
      const tree = asCustomCodeRoot(kernel.getDocument().nodes[nodeId]?.props[treeKey]);
      const current = tree === undefined ? undefined : customCodeNodeAtPath(tree, path);
      if (tree === undefined || current === undefined) {
        return { ok: false, message: ELEMENT_GONE };
      }
      const value = replaceCustomCodeNodeAtPath(tree, path, field.write(current, next));
      try {
        kernel.dispatch('setProp', { id: nodeId, key: treeKey, value }, 'user');
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    };

  const sections = customCodeElementSections(element);
  const basePath = ['props', treeKey, ...path.flatMap((index) => ['children', index])];

  return (
    <div className="bldr-inspector__element" data-element-kind={element.kind}>
      {sections.map((section) => (
        <InspectorElementSection key={section.name} name={section.name}>
          {section.fields.map((field) => {
            const value = field.read(element);
            return (
              <InspectorRowBody
                key={field.key}
                kernel={kernel}
                nodeId={nodeId}
                propKey={field.key}
                schema={field.schema}
                palette={palette}
                bucket="base"
                value={value}
                baseValue={value}
                hasOverride={false}
                catalogVersion={catalogVersion}
                announce={announce}
                dir={dir}
                path={[...basePath, field.key]}
                commitValue={commitFor(field)}
                nested
                deferTextCommit
                responsiveCapable={false}
              />
            );
          })}
        </InspectorElementSection>
      ))}
    </div>
  );
}
