import { useId, useState, type SyntheticEvent } from 'react';

import { NAMED_STYLE_PREFIX } from '@craftkit/builder-schema';

import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import type { ElementBarModel, QuickWriteResult } from './element-bar-model';
import type { ElementQuickBarLabels } from './ElementQuickBar.labels';
import { quickGroup, type QuickGroupId } from './quick-bar-groups';
import { QuickPropertyControl } from './QuickPropertyControl';

export interface NamedStyleChoice {
  readonly id: string;
  readonly name: string;
}

export interface QuickGroupPanelProps {
  readonly group: QuickGroupId;
  readonly model: ElementBarModel;
  readonly labels: ElementQuickBarLabels;
  readonly dir: 'ltr' | 'rtl';
  readonly colorTokens: readonly ColorSwatch[];
  readonly palette?: readonly ColorSwatch[] | undefined;
  readonly namedStyles?: readonly NamedStyleChoice[] | undefined;
  readonly onResult: (result: QuickWriteResult) => void;
}

const MARKER = new RegExp(`(^|\\s)${NAMED_STYLE_PREFIX}[a-z][a-z0-9-]*(?=\\s|$)`, 'gu');

function markerOf(className: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${NAMED_STYLE_PREFIX}([a-z][a-z0-9-]*)(?=\\s|$)`, 'u').exec(className);
  return match?.[1];
}

/**
 * The compact popover body of one quick-bar group: the catalogue rows of the
 * group through `QuickPropertyControl`, or the group's own small editor (link,
 * alt text, style preset, icon name and size). Text fields commit on Apply or
 * Enter, so typing never writes a transaction per keystroke.
 */
export function QuickGroupPanel({
  group,
  model,
  labels,
  dir,
  colorTokens,
  palette,
  namedStyles,
  onResult,
}: QuickGroupPanelProps) {
  const fieldId = useId();
  const node = model.node;
  const groupLabel = labels.groups[group];
  const [href, setHref] = useState(model.attribute('href') ?? '');
  const [newTab, setNewTab] = useState(model.attribute('target') === '_blank');
  const [alt, setAlt] = useState(model.attribute('alt') ?? '');
  const [iconName, setIconName] = useState(node.kind === 'icon' ? node.name : '');
  const [iconSize, setIconSize] = useState(node.kind === 'icon' && node.size !== undefined ? String(node.size) : '');

  const submit = (event: SyntheticEvent, run: () => QuickWriteResult) => {
    event.preventDefault();
    onResult(run());
  };

  const properties = quickGroup(group).properties;
  if (properties.length > 0) {
    return (
      <div className="bldr-quick-bar__panel-body">
        {properties.map((property) => (
          <QuickPropertyControl
            key={property}
            property={property}
            model={model}
            labels={labels}
            dir={dir}
            colorTokens={colorTokens}
            palette={palette}
            onResult={onResult}
          />
        ))}
      </div>
    );
  }

  switch (group) {
    case 'link':
      return (
        <form
          className="bldr-quick-bar__panel-body"
          onSubmit={(event) => {
            submit(event, () =>
              model.setAttributes(
                {
                  href: href.trim() === '' ? null : href.trim(),
                  target: newTab ? '_blank' : null,
                  rel: newTab ? 'noopener noreferrer' : null,
                },
                groupLabel,
              ),
            );
          }}
        >
          <label className="bldr-quick-bar__field-label" htmlFor={`${fieldId}-href`}>
            {labels.href}
          </label>
          <input
            id={`${fieldId}-href`}
            className="bldr-quick-bar__input"
            type="text"
            inputMode="url"
            dir="ltr"
            value={href}
            onChange={(event) => {
              setHref(event.currentTarget.value);
            }}
          />
          <label className="bldr-quick-bar__check">
            <input
              type="checkbox"
              checked={newTab}
              onChange={(event) => {
                setNewTab(event.currentTarget.checked);
              }}
            />
            {labels.openInNewTab}
          </label>
          <button type="submit" className="bldr-quick-bar__apply">
            {labels.apply}
          </button>
        </form>
      );
    case 'alt':
      return (
        <form
          className="bldr-quick-bar__panel-body"
          onSubmit={(event) => {
            submit(event, () => model.setAttributes({ alt: alt.trim() }, groupLabel));
          }}
        >
          <label className="bldr-quick-bar__field-label" htmlFor={`${fieldId}-alt`}>
            {labels.altText}
          </label>
          <input
            id={`${fieldId}-alt`}
            className="bldr-quick-bar__input"
            type="text"
            value={alt}
            onChange={(event) => {
              setAlt(event.currentTarget.value);
            }}
          />
          <button type="submit" className="bldr-quick-bar__apply">
            {labels.apply}
          </button>
        </form>
      );
    case 'stylePreset': {
      const current = node.kind === 'component' ? undefined : markerOf(node.className ?? '');
      return (
        <div className="bldr-quick-bar__panel-body">
          <label className="bldr-quick-bar__field-label" htmlFor={`${fieldId}-style`}>
            {groupLabel}
          </label>
          <select
            id={`${fieldId}-style`}
            className="bldr-quick-bar__select"
            value={current ?? ''}
            onChange={(event) => {
              const next = event.currentTarget.value;
              onResult(
                model.editClasses((className) => {
                  const stripped = className.replace(MARKER, ' ');
                  return next === '' ? stripped : `${NAMED_STYLE_PREFIX}${next} ${stripped}`;
                }, groupLabel),
              );
            }}
          >
            <option value="">{labels.noStyle}</option>
            {(namedStyles ?? []).map((style) => (
              <option key={style.id} value={style.id}>
                {style.name}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case 'icon':
      return (
        <form
          className="bldr-quick-bar__panel-body"
          onSubmit={(event) => {
            submit(event, () => model.setIcon({ name: iconName.trim() }, groupLabel));
          }}
        >
          <label className="bldr-quick-bar__field-label" htmlFor={`${fieldId}-icon`}>
            {labels.iconName}
          </label>
          <input
            id={`${fieldId}-icon`}
            className="bldr-quick-bar__input"
            type="text"
            dir="ltr"
            value={iconName}
            onChange={(event) => {
              setIconName(event.currentTarget.value);
            }}
          />
          <button type="submit" className="bldr-quick-bar__apply">
            {labels.apply}
          </button>
        </form>
      );
    case 'iconSize':
      return (
        <form
          className="bldr-quick-bar__panel-body"
          onSubmit={(event) => {
            const size = Number(iconSize);
            submit(event, () =>
              model.setIcon(
                { size: iconSize.trim() === '' || !Number.isFinite(size) ? null : Math.round(size) },
                groupLabel,
              ),
            );
          }}
        >
          <label className="bldr-quick-bar__field-label" htmlFor={`${fieldId}-size`}>
            {labels.iconSize}
          </label>
          <input
            id={`${fieldId}-size`}
            className="bldr-quick-bar__input"
            type="number"
            min={8}
            max={256}
            value={iconSize}
            onChange={(event) => {
              setIconSize(event.currentTarget.value);
            }}
          />
          <button type="submit" className="bldr-quick-bar__apply">
            {labels.apply}
          </button>
        </form>
      );
    default:
      return null;
  }
}
