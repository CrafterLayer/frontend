import { useId } from 'react';
import { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { PaletteEntry } from '@craftkit/builder-renderer';
import {
  CUSTOM_CODE_BEHAVIORS,
  CUSTOM_CODE_BEHAVIOR_PARAMS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS,
  namedStyleIdOf,
  namedStyleMarker,
  type CustomCodeNode,
  type NamedStyle,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

import { ADVANCED_ATTRIBUTE_FIELDS, customCodeMediaParamFields } from '../../custom-code/element-fields';
import { UtilityClassField } from '../../fields/UtilityClassField';
import { ChoiceGroup } from '../../style-manager/controls/ChoiceGroup';
// media-motion (2026-10-06)
import {
  MEDIA_PARAM_FIELDS_LABELS_AR,
  MEDIA_PARAM_FIELDS_LABELS_EN,
  MediaParamFields,
} from '../../style-manager/controls/MediaParamFields';
import {
  SCENE_PRESET_PICKER_LABELS_AR,
  SCENE_PRESET_PICKER_LABELS_EN,
  ScenePresetPicker,
} from '../../style-manager/controls/ScenePresetPicker';
import { styleTransactionLabel, type StyleApplyResult } from '../../style-manager/style-source';
import { patchTreeTargets, type TreeTarget, type TreeWriteOptions } from '../../style-manager/tree-writes';
import type { InspectorElementLabels } from './element-panel.labels';
import { InspectorRowBody } from './InspectorRowBody';
import type { DocumentDirection } from './types';

export interface InspectorElementAdvancedProps {
  readonly kernel: BuilderKernel;
  readonly target: TreeTarget;
  readonly element: CustomCodeNode;
  readonly elementName: string;
  readonly palette: readonly PaletteEntry[];
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  readonly dir: DocumentDirection;
  readonly locale: 'en' | 'ar';
  readonly writeOptions: TreeWriteOptions;
  /** The site library's named styles, offered as `ck-s-*` chips. */
  readonly namedStyles: readonly NamedStyle[];
  readonly labels: InspectorElementLabels;
}

const classSchema = z.string().max(1_000).optional();
const PARAM_TEXT = z.string().max(2_000);

function attributesOf(node: CustomCodeNode): Readonly<Record<string, string | undefined>> {
  return node.kind === 'element' ? (node.attributes ?? {}) : {};
}

/** media-motion (2026-10-06): the `img` children of a scene layer (its fallback and textures). */
function imageChildCount(node: CustomCodeNode): number {
  return node.kind === 'element'
    ? (node.children ?? []).filter((child) => child.kind === 'element' && child.tag === 'img').length
    : 0;
}

/**
 * The Advanced group, last in the Design tab (style-manager DESIGN.md §A.4):
 * the raw class chips (UtilityClassField in FREE mode — an agent tree may use
 * exact values), the named styles the element wears, id / role / aria / lang
 * / tabindex, the text direction, and a site behaviour with its params. Each
 * change is one `patchTreeNode` transaction.
 */
export function InspectorElementAdvanced({
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
  namedStyles,
  labels,
}: InspectorElementAdvancedProps) {
  const ids = { classes: useId(), styles: useId(), behavior: useId() };
  const className = element.kind === 'component' ? '' : (element.className ?? '');
  const classList = className.split(/\s+/u).filter((name) => name !== '');
  const worn = classList.map(namedStyleIdOf).filter((id): id is string => id !== undefined);
  const attributes = attributesOf(element);
  const behavior = attributes['data-ck-behavior'];
  // media-motion (2026-10-06): typed rows for the media params; the free-text rows below skip them.
  const mediaFields = customCodeMediaParamFields(element);
  const typedParams = new Set(mediaFields.map((field) => field.key));
  // A media param tunes only its own behaviours (a gallery has no indicator row).
  const owners = CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS as Readonly<Record<string, readonly string[] | undefined>>;
  const freeParam = (param: string) => {
    if (typedParams.has(param)) return false;
    const tuned = owners[param];
    return tuned === undefined || (behavior !== undefined && tuned.includes(behavior));
  };
  const isScene = attributes['data-ck-scene'] !== undefined;
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';

  const write = (patch: TreeNodePatch, what: string): StyleApplyResult => {
    const result = patchTreeTargets(kernel, [{ target, patch }], styleTransactionLabel(what, elementName), writeOptions);
    announce(result.ok ? `${what} updated` : result.message);
    return result;
  };
  const setClasses = (next: readonly string[], what: string) =>
    write({ set: { className: next.length === 0 ? null : next.join(' ') } }, what);

  return (
    <section className="bldr-inspector__section bldr-inspector__advanced" aria-label={labels.advanced}>
      <h3 className="bldr-inspector__section-heading bldr-inspector__section-title">{labels.advanced}</h3>
      <div className="bldr-inspector__section-region bldr-inspector__advanced-body">
        {element.kind === 'component' ? null : (
          <div className="bldr-inspector__advanced-field">
            <span id={ids.classes} className="bldr-inspector__advanced-label">
              {labels.classes}
            </span>
            <UtilityClassField
              schema={classSchema}
              path={['element', ...target.path, 'className']}
              value={className === '' ? undefined : className}
              controlId={`${ids.classes}-input`}
              labelledBy={ids.classes}
              mode="free"
              onChange={(next) => {
                setClasses(typeof next === 'string' ? next.split(/\s+/u).filter((part) => part !== '') : [], labels.classes);
              }}
            />
          </div>
        )}

        {element.kind === 'component' || (namedStyles.length === 0 && worn.length === 0) ? null : (
          <div className="bldr-inspector__advanced-field">
            <span id={ids.styles} className="bldr-inspector__advanced-label">
              {labels.namedStyles}
            </span>
            <ul className="bldr-inspector__named-styles" aria-labelledby={ids.styles}>
              {worn.map((id) => {
                const name = namedStyles.find((style) => style.id === id)?.name ?? id;
                return (
                  <li key={id} className="bldr-inspector__named-style">
                    <span>{name}</span>
                    <button
                      type="button"
                      className="bldr-inspector__named-style-remove"
                      aria-label={labels.removeNamedStyle(name)}
                      onClick={() => {
                        setClasses(
                          classList.filter((part) => part !== namedStyleMarker(id)),
                          labels.namedStyles,
                        );
                      }}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {namedStyles.some((style) => !worn.includes(style.id)) ? (
              <select
                className="bldr-inspector__advanced-select"
                aria-label={labels.addNamedStyle}
                value=""
                onChange={(event) => {
                  if (event.target.value === '') return;
                  setClasses([...classList, namedStyleMarker(event.target.value)], labels.namedStyles);
                }}
              >
                <option value="">{labels.addNamedStyle}</option>
                {namedStyles
                  .filter((style) => !worn.includes(style.id))
                  .map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
              </select>
            ) : null}
          </div>
        )}

        {element.kind !== 'element' ? null : (
          <>
            <div className="bldr-inspector__advanced-field">
              <span className="bldr-inspector__advanced-label">{labels.direction}</span>
              <ChoiceGroup
                label={labels.direction}
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                value={attributes['dir'] ?? 'inherit'}
                options={(['inherit', 'auto', 'rtl', 'ltr'] as const).map((value) => ({
                  value,
                  label: labels.directions[value],
                }))}
                onChange={(value) => {
                  write({ attributes: { dir: value === 'inherit' ? null : value } }, labels.direction);
                }}
              />
            </div>

            <div className="bldr-inspector__rows">
              {ADVANCED_ATTRIBUTE_FIELDS.map((field) => {
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
                    path={['element', ...target.path, field.key]}
                    commitValue={(next) =>
                      field.patch === undefined ? { ok: true } : write(field.patch(next), field.label[locale])
                    }
                    pairItemLabel={field.label[locale]}
                    nested
                    deferTextCommit
                    responsiveCapable={false}
                  />
                );
              })}
            </div>

            <div className="bldr-inspector__advanced-field">
              <label className="bldr-inspector__advanced-label" htmlFor={ids.behavior}>
                {labels.behavior}
              </label>
              <select
                id={ids.behavior}
                className="bldr-inspector__advanced-select"
                value={behavior ?? ''}
                onChange={(event) => {
                  const next = event.target.value;
                  const patch: Record<string, string | null> = { 'data-ck-behavior': next === '' ? null : next };
                  if (next === '') {
                    // A param means nothing without its behaviour (the door refuses it alone).
                    for (const param of CUSTOM_CODE_BEHAVIOR_PARAMS) {
                      if (attributes[param] !== undefined && !(param === 'data-ck-speed' && attributes['data-ck-motion'] !== undefined)) {
                        patch[param] = null;
                      }
                    }
                  }
                  write({ attributes: patch }, labels.behavior);
                }}
              >
                <option value="">{labels.noBehavior}</option>
                {CUSTOM_CODE_BEHAVIORS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* media-motion (2026-10-06): typed media params and the scene layer's picker. */}
            {mediaFields.length === 0 ? null : (
              <div className="bldr-inspector__advanced-field">
                <MediaParamFields
                  dir={uiDir}
                  labels={locale === 'ar' ? MEDIA_PARAM_FIELDS_LABELS_AR : MEDIA_PARAM_FIELDS_LABELS_EN}
                  rows={mediaFields.map((field) => {
                    const value = field.read(element);
                    return {
                      key: field.key,
                      label: field.label[locale],
                      value: typeof value === 'string' ? value : undefined,
                      choices: field.choices,
                      input: field.input,
                    };
                  })}
                  onCommit={(key, value) => {
                    const field = mediaFields.find((entry) => entry.key === key);
                    if (field?.patch !== undefined) write(field.patch(value), field.label[locale]);
                  }}
                />
              </div>
            )}

            {isScene ? (
              <div className="bldr-inspector__advanced-field">
                <ScenePresetPicker
                  attributes={attributes}
                  imageCount={imageChildCount(element)}
                  dir={uiDir}
                  labels={locale === 'ar' ? SCENE_PRESET_PICKER_LABELS_AR : SCENE_PRESET_PICKER_LABELS_EN}
                  onCommit={(patch, what) => {
                    write({ attributes: { ...patch } }, what);
                  }}
                />
              </div>
            ) : null}

            {behavior === undefined ? null : (
              <div className="bldr-inspector__rows" role="group" aria-label={labels.behaviorParams}>
                {CUSTOM_CODE_BEHAVIOR_PARAMS.filter(freeParam).map((param) => {
                  const value = attributes[param];
                  const schema =
                    param === 'data-ck-speed' ? z.enum(['slow', 'normal', 'fast']).optional() : PARAM_TEXT;
                  return (
                    <InspectorRowBody
                      key={param}
                      kernel={kernel}
                      nodeId={target.nodeId}
                      propKey={param}
                      schema={schema}
                      palette={palette}
                      bucket="base"
                      value={value}
                      baseValue={value}
                      hasOverride={false}
                      catalogVersion={catalogVersion}
                      announce={announce}
                      dir={dir}
                      path={['element', ...target.path, param]}
                      commitValue={(next) =>
                        write(
                          {
                            attributes: {
                              [param]: typeof next === 'string' && next.trim() !== '' ? next.trim() : null,
                            },
                          },
                          param,
                        )
                      }
                      nested
                      deferTextCommit
                      responsiveCapable={false}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
