import {
  isPaletteColorValue,
  LIBRARY_LIMITS,
  NAMED_STYLE_MARKER_PREFIX,
  namedStyleClassProblem,
} from '@craftkit/builder-schema';

import { isRecord } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun, type AgentToolStep } from '../tools/agent/types';
import { elementName, no, ok, parseAddress, resolveElement, strictRecord, type ElementAddress, type Parsed } from './address';
import { finish, step } from './finish';
import { libraryIdFor } from './library-ids';
import { oklchRamp, RAMP_STEPS } from './oklch';

/*
  The site design library from the agent (style-manager DESIGN.md §2, D5/D6):
  named styles (Webflow-like classes) and palette colours. They expand to the
  SITE commands P5 added (setNamedStyle, setPaletteColor), which a page lens
  routes to the site in the same transaction as any page step; style.apply
  expands to page steps that add the marker class `ck-s-<id>`.

  Ids are derived from names by `libraryIdFor`, the same way in every tool,
  because a page kernel cannot read the site library back.
*/

// ── style.define ───────────────────────────────────────────────────────────────

export interface StyleDefineInput {
  readonly id: string;
  readonly name: string;
  readonly className: string;
}

function parseDefine(input: unknown): Parsed<StyleDefineInput> {
  const record = strictRecord(input, ['name', 'className'], '{"name","className"}');
  if (!record.ok) return record;
  const { name, className } = record.value;
  if (typeof name !== 'string' || name.trim() === '' || name.length > 80) return no('"name" must be the style\'s name (1-80 characters), e.g. "Card".');
  if (typeof className !== 'string' || className.trim() === '') return no('"className" must be the style\'s utilities, e.g. "rounded-xl bg-surface p-6 shadow-soft".');
  const classes = className.trim().replace(/\s+/gu, ' ');
  if (classes.length > LIBRARY_LIMITS.styleClassName) return no(`"className" must be at most ${String(LIBRARY_LIMITS.styleClassName)} characters.`);
  return ok({ id: libraryIdFor(name), name: name.trim(), className: classes });
}

function runDefine(input: StyleDefineInput): AgentToolRun {
  const problem = namedStyleClassProblem(input.className);
  if (problem !== undefined) return no(`style "${input.name}": ${problem} · send utilities the page can style.`);
  return {
    ok: true,
    steps: [
      {
        ...step('setNamedStyle', { style: { id: input.id, name: input.name, className: input.className } }),
        title: `Style · ${input.name}`,
      },
    ],
    note: `apply it with style.apply {"style":"${input.id}"} — elements then carry ${NAMED_STYLE_MARKER_PREFIX}${input.id}.`,
  };
}

export const styleDefineTool = defineAgentTool<StyleDefineInput>({
  name: 'style.define',
  lanes: ['edit'],
  summary: 'Define a reusable named style',
  signature: '{name,className}',
  parse: parseDefine,
  run: runDefine,
});

// ── style.apply ────────────────────────────────────────────────────────────────

export interface StyleApplyInput {
  readonly style: string;
  readonly targets: readonly ElementAddress[];
  readonly remove: boolean;
}

function parseApply(input: unknown): Parsed<StyleApplyInput> {
  const record = strictRecord(input, ['style', 'targets', 'remove'], '{"style","targets":[{id,path|find}],"remove"?}');
  if (!record.ok) return record;
  const style = record.value['style'];
  if (typeof style !== 'string' || style.trim() === '') return no('"style" is the style\'s name or id, as given to style.define.');
  const list = record.value['targets'];
  if (!Array.isArray(list) || list.length === 0 || list.length > 100) return no('"targets" must be 1-100 elements, each {id,path|find}.');
  const targets: ElementAddress[] = [];
  for (const [index, entry] of (list as unknown[]).entries()) {
    const target = strictRecord(entry, ['id', 'path', 'find'], '{"id","path"|"find"}');
    if (!target.ok) return no(`targets[${String(index)}]: ${target.error}`);
    const address = parseAddress(target.value);
    if (!address.ok) return no(`targets[${String(index)}]: ${address.error}`);
    targets.push(address.value);
  }
  const remove = record.value['remove'];
  if (remove !== undefined && typeof remove !== 'boolean') return no('"remove" is true to take the style off.');
  return ok({ style: libraryIdFor(style), targets, remove: remove === true });
}

function runApply(input: StyleApplyInput, context: AgentToolContext): AgentToolRun {
  const marker = `${NAMED_STYLE_MARKER_PREFIX}${input.style}`;
  const steps: AgentToolStep[] = [];
  const seen = new Set<string>();
  let first = '';
  for (const address of input.targets) {
    const target = resolveElement(context, address);
    if (!target.ok) return target;
    const { node, id, path } = target.value;
    const key = `${id}|${path.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (node.kind === 'component') return no(`the node at [${path.join(',')}] in "${id}" is a component, which takes no classes · wrap it first.`);
    const classes = (node.className ?? '').split(/\s+/u).filter((name) => name !== '');
    const has = classes.includes(marker);
    if (input.remove ? !has : has) continue;
    const next = input.remove ? classes.filter((name) => name !== marker) : [marker, ...classes];
    if (first === '') first = elementName(node);
    steps.push(step('patchTreeNode', { id, path: [...path], set: { className: next.length === 0 ? null : next.join(' ') } }));
  }
  if (steps.length === 0) return no(`nothing to change · ${input.remove ? 'none of the targets carries' : 'every target already carries'} ${marker}.`);
  const verb = input.remove ? 'Remove style' : 'Apply style';
  return finish(context, steps, steps.length === 1 ? `${verb} ${input.style} · ${first}` : `${verb} ${input.style} · ${String(steps.length)} elements`);
}

export const styleApplyTool = defineAgentTool<StyleApplyInput>({
  name: 'style.apply',
  lanes: ['edit', 'section'],
  summary: 'Apply a named style to elements',
  signature: '{style,targets:[{id,path|find}],remove?}',
  parse: parseApply,
  run: runApply,
});

// ── palette.set ────────────────────────────────────────────────────────────────

export interface PaletteColorInput {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly group?: string;
}

export interface PaletteSetInput {
  readonly colors: readonly PaletteColorInput[];
}

function parsePalette(input: unknown): Parsed<PaletteSetInput> {
  const record = strictRecord(input, ['colors', 'ramp'], '{"colors":[{name,value}],"ramp"?:name}');
  if (!record.ok) return record;
  const list = record.value['colors'];
  if (!Array.isArray(list) || list.length === 0 || list.length > 24) return no('"colors" must be 1-24 entries, each {name, value} (value #hex, rgb() or oklch()).');
  const colors: PaletteColorInput[] = [];
  for (const [index, entry] of (list as unknown[]).entries()) {
    if (!isRecord(entry)) return no(`colors[${String(index)}] must be {name, value}.`);
    const extra = Object.keys(entry).filter((key) => key !== 'name' && key !== 'value');
    if (extra.length > 0) return no(`colors[${String(index)}]: unknown keys ${extra.join(', ')}; use name, value.`);
    const { name, value } = entry;
    if (typeof name !== 'string' || name.trim() === '' || name.length > 60) return no(`colors[${String(index)}].name must be 1-60 characters, e.g. "Brand".`);
    if (typeof value !== 'string' || !isPaletteColorValue(value.trim())) {
      return no(`colors[${String(index)}].value must be one colour: #0f766e, rgb(15 118 110) or oklch(55% 0.12 180).`);
    }
    colors.push({ id: libraryIdFor(name, 'c'), name: name.trim(), value: value.trim() });
  }
  const ramp = record.value['ramp'];
  if (ramp === undefined) return ok({ colors });
  if (typeof ramp !== 'string' || ramp.trim() === '') return no('"ramp" is the name of one of "colors" to expand into 50-950 shades.');
  const rampId = libraryIdFor(ramp, 'c');
  const base = colors.find((color) => color.id === rampId || color.name === ramp.trim());
  if (base === undefined) return no(`"ramp" names "${ramp}", which is not in "colors" · send the name of one of them.`);
  const shades = oklchRamp(base.value);
  if (shades === undefined) return no(`"${base.value}" cannot be ramped · give the base as #hex, rgb() or oklch().`);
  for (const shade of RAMP_STEPS) {
    const id = `${base.id}-${shade}`.slice(0, 48);
    if (colors.some((color) => color.id === id)) continue;
    colors.push({ id, name: `${base.name} ${shade}`, value: shades[shade], group: base.id });
  }
  if (colors.length > LIBRARY_LIMITS.palette) return no(`a palette holds at most ${String(LIBRARY_LIMITS.palette)} colours.`);
  return ok({ colors });
}

function runPalette(input: PaletteSetInput): AgentToolRun {
  const steps = input.colors.map((color) =>
    step('setPaletteColor', {
      color: { id: color.id, name: color.name, value: color.value, ...(color.group === undefined ? {} : { group: color.group }) },
    }),
  );
  const [first, ...rest] = steps;
  /* v8 ignore next -- parse guarantees at least one colour. */
  if (first === undefined) return no('no colours.');
  const names = input.colors.filter((color) => color.group === undefined).map((color) => color.name);
  return {
    ok: true,
    steps: [{ ...first, title: `Palette · ${names.join(', ')}`.slice(0, 160) }, ...rest],
    note: `use them as bg-(--ck-c-<id>) / text-(--ck-c-<id>) or element.style value "palette:<id>"; ids: ${input.colors
      .map((color) => color.id)
      .slice(0, 14)
      .join(', ')}.`,
  };
}

export const paletteSetTool = defineAgentTool<PaletteSetInput>({
  name: 'palette.set',
  lanes: ['edit'],
  summary: 'Add site palette colours, optional shade ramp',
  signature: '{colors:[{name,value}],ramp?:name}',
  parse: parsePalette,
  run: runPalette,
});
