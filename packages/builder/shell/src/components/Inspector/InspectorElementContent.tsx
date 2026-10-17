import type { BuilderKernel } from '@craftkit/builder-core';
import type { PaletteEntry } from '@craftkit/builder-renderer';
import {
  isCustomCodeIconName,
  type CustomCodeComponent,
  type CustomCodeNode,
} from '@craftkit/builder-schema';

import {
  customCodeElementSections,
  type CustomCodeElementField,
} from '../../custom-code/element-fields';
import type { FieldCommit, FieldCommitResult } from '../../fields/field-commit';
import { propsShapeOf } from '../../fields/resolve-field';
import { styleTransactionLabel } from '../../style-manager/style-source';
import {
  ELEMENT_GONE,
  patchTreeTargets,
  readTreeTarget,
  setTreeTarget,
  type TreeTarget,
  type TreeWriteOptions,
} from '../../style-manager/tree-writes';
import { IconBrowser } from '../IconBrowser/IconBrowser';
import { ICON_BROWSER_LABELS_AR, ICON_BROWSER_LABELS_EN } from '../IconBrowser/IconBrowser.labels';
import { InspectorElementSection } from './InspectorElementSection';
import { InspectorRowBody } from './InspectorRowBody';
import type { DocumentDirection } from './types';

export interface InspectorElementContentProps {
  readonly kernel: BuilderKernel;
  readonly target: TreeTarget;
  readonly element: CustomCodeNode;
  /** The element's display name, for transaction labels. */
  readonly elementName: string;
  readonly palette: readonly PaletteEntry[];
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  readonly dir: DocumentDirection;
  readonly locale: 'en' | 'ar';
  readonly writeOptions: TreeWriteOptions;
  /** Shown when the element has no content traits (a divider, a container with children). */
  readonly emptyText: string;
  readonly componentHeading: string;
}

/** Said when a typed icon name is not in its set (walk 2026-10-08: "zzzz" drew nothing). */
const UNKNOWN_ICON: Readonly<Record<'en' | 'ar', (name: string) => string>> = {
  en: (name) => `There is no icon named “${name}” in this set · pick one from the icons below.`,
  ar: (name) => `لا توجد أيقونة باسم «${name}» في هذه المجموعة · اختر واحدة من الأيقونات أدناه.`,
};

function componentWithProp(component: CustomCodeComponent, key: string, value: unknown): CustomCodeComponent {
  const props: Record<string, unknown> = Object.fromEntries(
    Object.entries(component.props ?? {}).filter(([name]) => name !== key),
  );
  if (value !== undefined) props[key] = value;
  const next: CustomCodeComponent = { ...component };
  if (Object.keys(props).length === 0) delete next.props;
  else next.props = props;
  return next;
}

/**
 * The Content tab of the element panel: the element's traits by tag
 * (element-fields.ts), an icon's set/name/size/stroke/label, or — for a
 * component inside the tree — rows from the referenced block's own schema,
 * validated by that schema at write. Each row commits ONE transaction:
 * `patchTreeNode` for element traits, `setTreeNode` for icons and component
 * props. Values read from document truth at commit time, never the render's
 * closure, so two rows committing in one blur sequence build on each other.
 */
export function InspectorElementContent({
  kernel,
  target,
  element,
  elementName,
  palette,
  catalogVersion,
  announce,
  dir,
  locale,
  writeOptions,
  emptyText,
  componentHeading,
}: InspectorElementContentProps) {
  const commitField =
    (field: CustomCodeElementField): FieldCommit =>
    (next): FieldCommitResult => {
      const current = readTreeTarget(kernel, target, writeOptions);
      if (current === undefined) return { ok: false, message: ELEMENT_GONE };
      const label = styleTransactionLabel(field.label[locale], elementName);
      if (field.patch !== undefined) {
        return patchTreeTargets(kernel, [{ target, patch: field.patch(next) }], label, writeOptions);
      }
      if (field.write !== undefined) {
        const written = field.write(current, next);
        // An icon whose name its set does not have renders nothing: refused
        // here with the reason, before it reaches the page.
        if (written.kind === 'icon' && !isCustomCodeIconName(written.name)) {
          return { ok: false, message: UNKNOWN_ICON[locale](written.name) };
        }
        return setTreeTarget(kernel, target, written, label, writeOptions);
      }
      return { ok: true };
    };

  /* A picked icon replaces the name (set included) as ONE transaction. */
  const pickIcon = (name: string): void => {
    const current = readTreeTarget(kernel, target, writeOptions);
    if (current?.kind !== 'icon' || current.name === name) return;
    const result = setTreeTarget(
      kernel,
      target,
      { ...current, name },
      styleTransactionLabel(locale === 'ar' ? 'الأيقونة' : 'Icon', elementName),
      writeOptions,
    );
    if (!result.ok) announce(result.message);
  };

  const basePath = ['element', ...target.path];

  if (element.kind === 'component') {
    const schema = kernel.context.registry.block(element.component)?.schema;
    const rows = schema === undefined ? [] : Object.entries(propsShapeOf(schema.props));
    if (rows.length === 0) return <p className="bldr-inspector__element-note">{emptyText}</p>;
    return (
      <InspectorElementSection name={componentHeading}>
        {rows.map(([key, propSchema]) => {
          const value = element.props?.[key];
          return (
            <InspectorRowBody
              key={key}
              kernel={kernel}
              nodeId={target.nodeId}
              propKey={key}
              schema={propSchema}
              palette={palette}
              bucket="base"
              value={value}
              baseValue={value}
              hasOverride={false}
              catalogVersion={catalogVersion}
              announce={announce}
              dir={dir}
              path={[...basePath, 'props', key]}
              commitValue={(next) => {
                const current = readTreeTarget(kernel, target, writeOptions);
                if (current?.kind !== 'component') return { ok: false, message: ELEMENT_GONE };
                return setTreeTarget(
                  kernel,
                  target,
                  componentWithProp(current, key, next),
                  styleTransactionLabel(key, elementName),
                  writeOptions,
                );
              }}
              nested
              deferTextCommit
              responsiveCapable={false}
            />
          );
        })}
      </InspectorElementSection>
    );
  }

  const sections = customCodeElementSections(element);
  if (sections.length === 0) return <p className="bldr-inspector__element-note">{emptyText}</p>;
  return (
    <>
      {sections.map((section) => (
        <InspectorElementSection key={section.name.en} name={section.name[locale]}>
          {section.fields.map((field) => {
            const value = field.read(element);
            return (
              <InspectorRowBody
                key={field.key}
                kernel={kernel}
                nodeId={target.nodeId}
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
                commitValue={commitField(field)}
                pairItemLabel={field.label[locale]}
                nested
                deferTextCommit
                responsiveCapable={false}
              />
            );
          })}
          {/* An icon is chosen by sight, not by spelling its name. */}
          {element.kind === 'icon' ? (
            <IconBrowser
              value={element.name}
              onPick={pickIcon}
              limit={48}
              labels={locale === 'ar' ? ICON_BROWSER_LABELS_AR : ICON_BROWSER_LABELS_EN}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            />
          ) : null}
        </InspectorElementSection>
      ))}
    </>
  );
}
