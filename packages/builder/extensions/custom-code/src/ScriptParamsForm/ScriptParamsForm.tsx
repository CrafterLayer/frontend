import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  isHexColour,
  paramDefaults,
  paramsDiffFromDefaults,
  SCRIPT_PARAM_GROUP_LABELS,
  SCRIPT_PARAM_GROUPS,
  validateParamValues,
  type Bilingual,
  type CustomCodeJsParams,
  type ScriptParamSpec,
  type ScriptParamValue,
} from '@craftkit/builder-schema';

import { scriptParamsFormStrings, type ScriptParamsFormStrings } from './ScriptParamsForm.labels';

import './ScriptParamsForm.css';

export interface ScriptParamsFormAsset {
  id: string;
  url: string;
  label?: string;
}

export interface ScriptParamsSoundOption {
  value: string;
  label: Bilingual | string;
}

export interface ScriptParamsChange {
  /** False while a gesture is in flight (preview only); true once per gesture (one Undo entry). */
  commit: boolean;
}

export interface ScriptParamsFormProps {
  spec: readonly ScriptParamSpec[];
  /** The stored values (`jsParams`): only keys that differ from the defaults, usually. */
  values: Readonly<CustomCodeJsParams> | undefined;
  /** Receives the values to store — only keys that differ from their defaults. */
  onChange: (values: CustomCodeJsParams, change: ScriptParamsChange) => void;
  /** UI language for labels and help; `ar…` reads Arabic. Default `en`. */
  locale?: string;
  dir?: 'ltr' | 'rtl';
  /** Site images an `image` param may pick, by asset id. */
  assets?: readonly ScriptParamsFormAsset[];
  /** Opens the host's image picker; resolves to the chosen value (URL or asset id). */
  onPickImage?: (key: string) => Promise<string | undefined> | string | undefined;
  /** Choices for `sound` params (bank ids, `lib:<id>`); without them a text field. */
  soundOptions?: readonly ScriptParamsSoundOption[];
  disabled?: boolean;
}

const MAX_PALETTE_SWATCHES = 6;
const IMAGE_VALUE = /^(?:https:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/u;
const STEP_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

function pick(text: Bilingual, arabic: boolean): string {
  return arabic ? text.ar : text.en;
}

function same(a: ScriptParamValue | undefined, b: ScriptParamValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

function hex6(value: string): string {
  // <input type=color> takes #rrggbb only.
  const clean = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/u.test(clean)) return clean;
  if (/^#[0-9a-f]{3,4}$/u.test(clean)) {
    return `#${clean.charAt(1).repeat(2)}${clean.charAt(2).repeat(2)}${clean.charAt(3).repeat(2)}`;
  }
  if (/^#[0-9a-f]{8}$/u.test(clean)) return clean.slice(0, 7);
  return '#000000';
}

function formatNumber(value: number, step: number | undefined): string {
  if (step === undefined || step >= 1) return String(Math.round(value * 1e6) / 1e6);
  const digits = Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
  return String(Number(value.toFixed(digits)));
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M3.5 6.5a5 5 0 1 1-.4 4M3 2.8v3.9h3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The controls for a script's params (pixi-studio DESIGN.md §D.2): one control
 * per param, grouped (Look, Motion, Interaction, Sound) with bilingual labels
 * and help. Used by the Inspector (`CustomCodeParamsField`) and the Script
 * Studio.
 *
 * Every gesture is ONE commit — one Undo entry. A slider drag previews live
 * (`commit: false`) and commits once on release; a keyboard step commits on
 * key release; text, number and hex fields commit on Enter or when focus
 * leaves; switches, radios, selects and swatch buttons commit at once.
 * Values come back as what `jsParams` stores: only keys that differ from the
 * defaults, coerced and clamped by `validateParamValues`.
 */
export default function ScriptParamsForm({
  spec,
  values,
  onChange,
  locale = 'en',
  dir = 'ltr',
  assets,
  onPickImage,
  soundOptions,
  disabled = false,
}: ScriptParamsFormProps) {
  const baseId = useId();
  const arabic = locale.toLowerCase().startsWith('ar');
  const strings: ScriptParamsFormStrings = scriptParamsFormStrings(locale);

  const defaults = useMemo(() => paramDefaults(spec), [spec]);
  const stored = useMemo(() => validateParamValues(spec, values).values, [spec, values]);
  const base = useMemo(() => ({ ...defaults, ...stored }), [defaults, stored]);

  const [draft, setDraft] = useState<Record<string, ScriptParamValue>>({});
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const draftRef = useRef<Record<string, ScriptParamValue>>({});
  const latest = useRef({ base, spec, onChange });
  useLayoutEffect(() => {
    latest.current = { base, spec, onChange };
  });

  const shown: Record<string, ScriptParamValue> = { ...base, ...draft };

  const emit = (merged: Record<string, ScriptParamValue>): CustomCodeJsParams => {
    const { spec: currentSpec } = latest.current;
    const checked = validateParamValues(currentSpec, merged).values;
    return paramsDiffFromDefaults(currentSpec, checked);
  };

  const setDraftKey = (key: string, value: ScriptParamValue | undefined): void => {
    const next = Object.fromEntries(
      Object.entries(draftRef.current).filter(([entryKey]) => entryKey !== key),
    );
    if (value !== undefined) next[key] = value;
    draftRef.current = next;
    setDraft(next);
  };

  /** A preview step: the parent may show it, and must not record it. */
  const live = (key: string, value: ScriptParamValue): void => {
    setDraftKey(key, value);
    const { base: current, onChange: notify } = latest.current;
    notify(emit({ ...current, ...draftRef.current }), { commit: false });
  };

  /** The end of a gesture: one commit, and only when something changed. */
  const commit = (key: string, value?: ScriptParamValue): void => {
    const next = value ?? draftRef.current[key];
    setDraftKey(key, undefined);
    if (next === undefined) return;
    const { base: current, onChange: notify } = latest.current;
    if (same(next, current[key])) return;
    notify(emit({ ...current, ...draftRef.current, [key]: next }), { commit: true });
  };

  const pending = (key: string): boolean => Object.hasOwn(draftRef.current, key);

  /** Commit on the input's NATIVE change event (slider release, colour picker close, field blur). */
  const commitOnNativeChange = (key: string) => (element: HTMLInputElement | null) => {
    if (element === null) return undefined;
    const listener = () => {
      if (pending(key)) commit(key);
    };
    element.addEventListener('change', listener);
    return () => {
      element.removeEventListener('change', listener);
    };
  };

  const commitOnEnter = (key: string) => (event: { key: string }) => {
    if (event.key === 'Enter' && pending(key)) commit(key);
  };

  const groups = SCRIPT_PARAM_GROUPS.map((group) => ({
    group,
    params: spec.filter((entry) => (entry.group ?? 'look') === group),
  })).filter((entry) => entry.params.length > 0);

  if (spec.length === 0) {
    return (
      <div className="bldr-spf" dir={dir} lang={arabic ? 'ar' : 'en'}>
        <p className="bldr-spf__empty">{strings.empty}</p>
      </div>
    );
  }

  const renderControl = (param: ScriptParamSpec, ids: { control: string; help?: string }) => {
    const { key } = param;
    const label = pick(param.label, arabic);
    const value = shown[key];
    const describedBy = ids.help;

    switch (param.type) {
      case 'number':
      case 'range': {
        const number = typeof value === 'number' ? value : Number(param.default);
        const slider = param.type === 'range' && param.min !== undefined && param.max !== undefined;
        return (
          <div className="bldr-spf__number">
            {slider ? (
              <input
                type="range"
                className="bldr-spf__slider"
                id={ids.control}
                aria-describedby={describedBy}
                min={param.min}
                max={param.max}
                step={param.step ?? 'any'}
                value={number}
                disabled={disabled}
                ref={commitOnNativeChange(key)}
                onChange={(event) => {
                  live(key, Number(event.target.value));
                }}
                onPointerUp={() => {
                  if (pending(key)) commit(key);
                }}
                onKeyUp={(event) => {
                  if (STEP_KEYS.has(event.key) && pending(key)) commit(key);
                }}
                onBlur={() => {
                  if (pending(key)) commit(key);
                }}
              />
            ) : null}
            <input
              type="number"
              className="bldr-spf__number-input"
              id={slider ? undefined : ids.control}
              aria-label={slider ? label : undefined}
              aria-describedby={describedBy}
              inputMode="decimal"
              min={param.min}
              max={param.max}
              step={param.step ?? 'any'}
              value={formatNumber(number, param.step)}
              disabled={disabled}
              ref={commitOnNativeChange(key)}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) live(key, next);
              }}
              onKeyDown={commitOnEnter(key)}
              onBlur={() => {
                if (pending(key)) commit(key);
              }}
            />
          </div>
        );
      }

      case 'color': {
        const colour = typeof value === 'string' ? value : String(param.default);
        const text =
          typeof draft[`${key}#text`] === 'string' ? String(draft[`${key}#text`]) : colour;
        return (
          <div className="bldr-spf__colour">
            <input
              type="color"
              className="bldr-spf__swatch"
              id={ids.control}
              aria-describedby={describedBy}
              value={hex6(colour)}
              disabled={disabled}
              ref={commitOnNativeChange(key)}
              onChange={(event) => {
                live(key, event.target.value);
              }}
              onBlur={() => {
                if (pending(key)) commit(key);
              }}
            />
            <input
              type="text"
              className="bldr-spf__hex"
              dir="ltr"
              spellCheck={false}
              aria-label={strings.hex(label)}
              aria-invalid={invalid[key] === true ? true : undefined}
              value={text}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value.trim();
                setDraftKey(`${key}#text`, event.target.value);
                const ok = isHexColour(next);
                setInvalid((current) => ({ ...current, [key]: !ok && next !== '' }));
                if (ok) live(key, next.toLowerCase());
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setDraftKey(`${key}#text`, undefined);
                  if (pending(key)) commit(key);
                }
              }}
              onBlur={() => {
                setDraftKey(`${key}#text`, undefined);
                setInvalid((current) => ({ ...current, [key]: false }));
                if (pending(key)) commit(key);
              }}
            />
            {invalid[key] === true ? (
              <span className="bldr-spf__error" role="status">
                {strings.invalidHex}
              </span>
            ) : null}
          </div>
        );
      }

      case 'palette': {
        const isTheme = value === 'theme' || !Array.isArray(value);
        const colours: readonly string[] = Array.isArray(value) ? value : [];
        const fallbackColours: readonly string[] = Array.isArray(param.default)
          ? param.default
          : ['#e8a33d', '#2f6f73', '#f4ede1'];
        const name = `${baseId}-${key}-mode`;
        return (
          <div className="bldr-spf__palette">
            <div className="bldr-spf__segmented" role="radiogroup" aria-label={label}>
              <label className="bldr-spf__segment">
                <input
                  type="radio"
                  name={name}
                  checked={isTheme}
                  disabled={disabled}
                  onChange={() => {
                    commit(key, 'theme');
                  }}
                />
                <span>{strings.theme}</span>
              </label>
              <label className="bldr-spf__segment">
                <input
                  type="radio"
                  name={name}
                  checked={!isTheme}
                  disabled={disabled}
                  onChange={() => {
                    commit(key, [...fallbackColours].slice(0, MAX_PALETTE_SWATCHES));
                  }}
                />
                <span>{strings.custom}</span>
              </label>
            </div>
            {isTheme ? null : (
              <ul className="bldr-spf__swatches">
                {colours.map((swatch, index) => (
                  // The list is positional: index IS the identity of a swatch.
                  <li key={index} className="bldr-spf__swatch-item">
                    <input
                      type="color"
                      className="bldr-spf__swatch"
                      aria-label={strings.swatch(index + 1)}
                      value={hex6(swatch)}
                      disabled={disabled}
                      ref={commitOnNativeChange(key)}
                      onChange={(event) => {
                        const next = [...colours];
                        next[index] = event.target.value;
                        live(key, next);
                      }}
                      onBlur={() => {
                        if (pending(key)) commit(key);
                      }}
                    />
                    {colours.length > 1 ? (
                      <button
                        type="button"
                        className="bldr-spf__icon-button"
                        aria-label={strings.removeColour(index + 1)}
                        disabled={disabled}
                        onClick={() => {
                          commit(
                            key,
                            colours.filter((_, at) => at !== index),
                          );
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    ) : null}
                  </li>
                ))}
                {colours.length < MAX_PALETTE_SWATCHES ? (
                  <li>
                    <button
                      type="button"
                      className="bldr-spf__add"
                      disabled={disabled}
                      onClick={() => {
                        commit(key, [...colours, colours.at(-1) ?? '#888888']);
                      }}
                    >
                      {strings.addColour}
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        );
      }

      case 'select': {
        const options = param.options ?? [];
        const current = typeof value === 'string' ? value : String(param.default);
        if (options.length <= 4) {
          const name = `${baseId}-${key}`;
          return (
            <div
              className="bldr-spf__segmented"
              role="radiogroup"
              aria-label={label}
              aria-describedby={describedBy}
            >
              {options.map((option) => (
                <label key={option.value} className="bldr-spf__segment">
                  <input
                    type="radio"
                    name={name}
                    value={option.value}
                    checked={current === option.value}
                    disabled={disabled}
                    onChange={() => {
                      commit(key, option.value);
                    }}
                  />
                  <span>{pick(option.label, arabic)}</span>
                </label>
              ))}
            </div>
          );
        }
        return (
          <select
            className="bldr-spf__select"
            id={ids.control}
            aria-describedby={describedBy}
            value={current}
            disabled={disabled}
            onChange={(event) => {
              commit(key, event.target.value);
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {pick(option.label, arabic)}
              </option>
            ))}
          </select>
        );
      }

      case 'toggle': {
        const on = value === true;
        return (
          <button
            type="button"
            role="switch"
            className="bldr-spf__switch"
            id={ids.control}
            aria-checked={on}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => {
              commit(key, !on);
            }}
          >
            <span className="bldr-spf__switch-track" aria-hidden="true">
              <span className="bldr-spf__switch-thumb" />
            </span>
            <span className="bldr-spf__switch-text">{on ? strings.on : strings.off}</span>
          </button>
        );
      }

      case 'text':
        return (
          <input
            type="text"
            className="bldr-spf__text"
            id={ids.control}
            dir="auto"
            aria-describedby={describedBy}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            ref={commitOnNativeChange(key)}
            onChange={(event) => {
              live(key, event.target.value);
            }}
            onKeyDown={commitOnEnter(key)}
            onBlur={() => {
              if (pending(key)) commit(key);
            }}
          />
        );

      case 'image': {
        const current = typeof value === 'string' ? value : '';
        const assetIds = new Set((assets ?? []).map((asset) => asset.id));
        const isAsset = assetIds.has(current);
        const urlValue = isAsset ? '' : current;
        const preview = isAsset
          ? (assets ?? []).find((asset) => asset.id === current)?.url
          : IMAGE_VALUE.test(current)
            ? current
            : undefined;
        return (
          <div className="bldr-spf__image">
            {preview !== undefined ? (
              <img className="bldr-spf__thumb" src={preview} alt="" loading="lazy" />
            ) : null}
            {assets !== undefined && assets.length > 0 ? (
              <select
                className="bldr-spf__select"
                aria-label={strings.imageAsset(label)}
                value={isAsset ? current : ''}
                disabled={disabled}
                onChange={(event) => {
                  commit(key, event.target.value);
                }}
              >
                <option value="">{strings.none}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.label ?? asset.id}
                  </option>
                ))}
              </select>
            ) : null}
            {onPickImage !== undefined ? (
              <button
                type="button"
                className="bldr-spf__add"
                disabled={disabled}
                onClick={() => {
                  void Promise.resolve(onPickImage(key)).then((chosen) => {
                    if (chosen !== undefined) commit(key, chosen);
                  });
                }}
              >
                {strings.chooseImage}
              </button>
            ) : null}
            <input
              type="url"
              className="bldr-spf__text"
              id={ids.control}
              dir="ltr"
              inputMode="url"
              aria-label={strings.imageUrl(label)}
              aria-describedby={describedBy}
              aria-invalid={invalid[key] === true ? true : undefined}
              value={urlValue}
              placeholder="https://"
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value.trim();
                const ok = next === '' || IMAGE_VALUE.test(next);
                setInvalid((state) => ({ ...state, [key]: !ok }));
                if (ok) live(key, next);
              }}
              onKeyDown={commitOnEnter(key)}
              onBlur={() => {
                setInvalid((state) => ({ ...state, [key]: false }));
                if (pending(key)) commit(key);
              }}
            />
            {invalid[key] === true ? (
              <span className="bldr-spf__error" role="status">
                {strings.invalidImage}
              </span>
            ) : null}
          </div>
        );
      }

      case 'sound': {
        const current = typeof value === 'string' ? value : '';
        if (soundOptions !== undefined && soundOptions.length > 0) {
          const known = soundOptions.some((option) => option.value === current);
          return (
            <select
              className="bldr-spf__select"
              id={ids.control}
              aria-describedby={describedBy}
              value={current}
              disabled={disabled}
              onChange={(event) => {
                commit(key, event.target.value);
              }}
            >
              <option value="">{strings.none}</option>
              {known || current === '' ? null : <option value={current}>{current}</option>}
              {soundOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {typeof option.label === 'string' ? option.label : pick(option.label, arabic)}
                </option>
              ))}
            </select>
          );
        }
        return (
          <input
            type="text"
            className="bldr-spf__text"
            id={ids.control}
            dir="ltr"
            spellCheck={false}
            aria-describedby={describedBy}
            value={current}
            disabled={disabled}
            ref={commitOnNativeChange(key)}
            onChange={(event) => {
              live(key, event.target.value);
            }}
            onKeyDown={commitOnEnter(key)}
            onBlur={() => {
              if (pending(key)) commit(key);
            }}
          />
        );
      }
    }
  };

  /** Params whose control is a group of its own (radios) name themselves; the rest get a <label>. */
  const selfLabelled = (param: ScriptParamSpec): boolean =>
    param.type === 'palette' || (param.type === 'select' && (param.options ?? []).length <= 4);

  const renderParam = (param: ScriptParamSpec): ReactNode => {
    const controlId = `${baseId}-${param.key}`;
    const helpId = param.help === undefined ? undefined : `${controlId}-help`;
    const label = pick(param.label, arabic);
    const changed = !same(shown[param.key], defaults[param.key]);
    return (
      <div key={param.key} className="bldr-spf__row" data-param={param.key} data-type={param.type}>
        <div className="bldr-spf__head">
          {selfLabelled(param) ? (
            <span className="bldr-spf__label" aria-hidden="true">
              {label}
            </span>
          ) : (
            <label className="bldr-spf__label" htmlFor={controlId}>
              {label}
            </label>
          )}
          {changed ? (
            <button
              type="button"
              className="bldr-spf__icon-button"
              aria-label={strings.reset(label)}
              title={strings.reset(label)}
              disabled={disabled}
              onClick={() => {
                const fallback = defaults[param.key];
                if (fallback !== undefined) commit(param.key, fallback);
              }}
            >
              <ResetIcon />
            </button>
          ) : null}
        </div>
        {renderControl(
          param,
          helpId === undefined ? { control: controlId } : { control: controlId, help: helpId },
        )}
        {param.help !== undefined && helpId !== undefined ? (
          <p className="bldr-spf__help" id={helpId}>
            {pick(param.help, arabic)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className="bldr-spf"
      dir={dir}
      lang={arabic ? 'ar' : 'en'}
      role="group"
      aria-label={strings.formLabel}
    >
      {groups.map(({ group, params }) => (
        <fieldset key={group} className="bldr-spf__group" disabled={disabled}>
          <legend className="bldr-spf__legend">
            {pick(SCRIPT_PARAM_GROUP_LABELS[group], arabic)}
          </legend>
          {params.map(renderParam)}
        </fieldset>
      ))}
    </div>
  );
}
