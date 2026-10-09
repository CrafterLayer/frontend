import { isRecord, type JsonRecord } from '../tools/agent/shared';
import { agentTool } from '../tools/agent/registry';
import { AGENT_TOOL_COMMAND, type AgentToolStep } from '../tools/agent/types';
import { didYouMean, scriptError } from './errors';
import type { Handle } from './handles';
import { normalizeStyleKey } from './style-keys';
import type {
  ScriptCall,
  ScriptElementKind,
  ScriptError,
  ScriptErrorCode,
  ScriptPage,
  ScriptStyleValue,
} from './types';

/**
 * A script's queued calls → ordinary agent tool steps (agent-script DESIGN
 * §A.6). Every `set` / `style` names elements by the ids `ck.find()` handed
 * out; each target becomes ONE step of the tool that already writes that
 * kind of element (element.attr / element.style for tree elements, part.* for
 * registered-block parts, a raw `patchTreeNode` for tree text, which the
 * coalescer folds into the region's tree). A `ck.tool` call passes through
 * verbatim, pre-parsed by its own tool so a bad input is reported with the
 * call number and the script line.
 *
 * Nothing here reads the kernel: a mapping error is about the script, and
 * its message says how to fix the script (§A.8).
 */

export const SCRIPT_ERROR_MAX_CHARS = 600;

export interface WriteMapContext {
  /** The open page's id. */
  readonly currentPage: string;
  /** Whether the host passed a site: without one, a write to another page is E_OTHER_PAGE. */
  readonly site: boolean;
  /** The tool names `ck.tool` may call (the lane's). */
  readonly tools: readonly string[];
  /** The indexed pages, to read `ck.tool(…, {page})` as an id or a slug. */
  readonly pages?: readonly ScriptPage[];
  /** The open page as the model knows it (its title or slug), for E_OTHER_PAGE. */
  readonly pageName?: string;
}

/** One tool step a call produced, with where it came from. */
export interface MappedStep {
  /** The call number (`ck.*` call #n, from 1). */
  readonly n: number;
  readonly line?: number;
  readonly origin: 'set' | 'style' | 'tool';
  /** The tool (or raw command) the step is: 'element.style', 'part.text', 'patchTreeNode'… */
  readonly tool: string;
  readonly step: AgentToolStep;
  /** The target's kind, for set/style. */
  readonly kind?: ScriptElementKind;
}

export type CallMapResult =
  | {
      readonly ok: true;
      /** Steps per page id, in call order. */
      readonly byPage: ReadonlyMap<string, readonly MappedStep[]>;
      /** How many element targets the set/style calls named. */
      readonly targets: number;
    }
  | { readonly ok: false; readonly error: ScriptError };

// ── Messages (§A.8, texts owned by errors.ts) ─────────────────────────────────

/** "call #3 (line 2)": where a message points in the script. */
export function scriptCallAt(n: number, line: number | undefined): string {
  return line === undefined ? `call #${String(n)}` : `call #${String(n)} (line ${String(line)})`;
}

/** A host-side script error with a ready message, capped at 600 characters. */
export function scriptHostError(code: ScriptErrorCode, message: string, line?: number): ScriptError {
  const text = message.length > SCRIPT_ERROR_MAX_CHARS ? `${message.slice(0, SCRIPT_ERROR_MAX_CHARS - 1)}…` : message;
  return line === undefined ? { code, message: text } : { code, message: text, line };
}

export function toolInputError(n: number | undefined, line: number | undefined, tool: string, message: string): ScriptError {
  return scriptError('E_TOOL_INPUT', { ...(n === undefined ? {} : { n }), ...(line === undefined ? {} : { line }), name: tool, message });
}

function badTarget(call: ScriptCall, reason: string): ScriptError {
  return scriptError('E_BAD_TARGET', { n: call.n, ...(call.line === undefined ? {} : { line: call.line }), message: reason });
}

export function otherPageError(pageId: string, line?: number): ScriptError {
  return scriptError('E_OTHER_PAGE', { page: pageId, ...(line === undefined ? {} : { line }) });
}

export function noToolError(n: number, line: number | undefined, name: string, tools: readonly string[]): ScriptError {
  const suggestion = didYouMean(name, tools);
  return scriptError('E_NO_TOOL', {
    n,
    ...(line === undefined ? {} : { line }),
    name,
    tools,
    ...(suggestion === undefined ? {} : { suggestion }),
  });
}

// ── Values ────────────────────────────────────────────────────────────────────

const SET_KEYS = ['text', 'href', 'src', 'alt'] as const;
type SetKey = (typeof SET_KEYS)[number];
type SetValue = Partial<Record<SetKey, string>>;

function readSetValue(call: ScriptCall & { op: 'set' }): { ok: true; value: SetValue } | { ok: false; error: ScriptError } {
  const raw: unknown = call.value;
  if (!isRecord(raw)) {
    return { ok: false, error: toolInputError(call.n, call.line, 'set', 'the second argument is {text?, href?, src?, alt?}.') };
  }
  const extra = Object.keys(raw).filter((key) => !(SET_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) {
    return { ok: false, error: toolInputError(call.n, call.line, 'set', `unknown keys ${extra.join(', ')}; use text, href, src, alt (styles go in ck.style).`) };
  }
  const value: SetValue = {};
  for (const key of SET_KEYS) {
    const entry = raw[key];
    if (entry === undefined || entry === null) continue;
    if (typeof entry !== 'string' && typeof entry !== 'number') {
      return { ok: false, error: toolInputError(call.n, call.line, 'set', `"${key}" must be a string.`) };
    }
    value[key] = String(entry);
  }
  if (Object.keys(value).length === 0) {
    return { ok: false, error: toolInputError(call.n, call.line, 'set', 'send text, href, src or alt.') };
  }
  return { ok: true, value };
}

interface StyleEntry {
  readonly property: string;
  readonly value: string | number | null;
  readonly bucket?: string;
  readonly state?: string;
}

function readStyles(
  call: ScriptCall & { op: 'style' },
  tool: string,
): { ok: true; entries: readonly StyleEntry[] } | { ok: false; error: ScriptError } {
  const styles: unknown = call.styles;
  if (!isRecord(styles) || Object.keys(styles).length === 0) {
    return { ok: false, error: toolInputError(call.n, call.line, tool, "send at least one style, e.g. {borderRadius:'full'}.") };
  }
  const entries: StyleEntry[] = [];
  for (const [key, raw] of Object.entries(styles as Readonly<Record<string, ScriptStyleValue>>)) {
    const property = normalizeStyleKey(key);
    if (!property.ok) return { ok: false, error: toolInputError(call.n, call.line, tool, property.error) };
    const inner: { readonly value?: unknown; readonly bucket?: unknown; readonly state?: unknown } = isRecord(raw) ? raw : { value: raw };
    const value = inner.value;
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
      return { ok: false, error: toolInputError(call.n, call.line, tool, `${property.property}: a value is a string, a number or null.`) };
    }
    const bucket = typeof inner.bucket === 'string' ? inner.bucket : call.options?.bucket;
    const state = typeof inner.state === 'string' ? inner.state : call.options?.state;
    entries.push({
      property: property.property,
      value,
      ...(bucket === undefined || bucket === 'base' ? {} : { bucket }),
      ...(state === undefined || state === 'default' ? {} : { state }),
    });
  }
  return { ok: true, entries };
}

function partIndex(index: readonly number[] | undefined): JsonRecord {
  if (index === undefined || index.length === 0) return {};
  return { index: index.length === 1 ? index[0] : [...index] };
}

function step(command: string, args: JsonRecord): AgentToolStep {
  return { command, args };
}

function tool(name: string, input: JsonRecord): AgentToolStep {
  return { command: AGENT_TOOL_COMMAND, args: { name, input } };
}

const ARTICLE: Readonly<Record<string, string>> = { image: 'an image', icon: 'an icon', video: 'a video', input: 'an input' };

// ── set ───────────────────────────────────────────────────────────────────────

function setSteps(
  call: ScriptCall & { op: 'set' },
  id: string,
  handle: Handle,
  value: SetValue,
): { ok: true; steps: { tool: string; step: AgentToolStep }[] } | { ok: false; error: ScriptError } {
  const fail = (reason: string) => ({ ok: false as const, error: badTarget(call, reason) });
  const section = handle.sectionId ?? handle.nodeId;
  if (handle.type === 'section') {
    return fail(`a section has no own text; use ck.find({section:'${section}', kind:'heading'})`);
  }
  const kind = handle.kind;
  if (handle.type === 'tree') {
    const out: { tool: string; step: AgentToolStep }[] = [];
    const path = [...(handle.path ?? [])];
    if (value.text !== undefined) {
      if (kind === 'image' || kind === 'video' || kind === 'icon') {
        return fail(`${ARTICLE[kind] ?? 'it'} has no text; set {src, alt} on it, or target a heading or text`);
      }
      if (kind === 'input') {
        return fail("an input has no text; set its placeholder with ck.tool('element.attr', {id: el.node, path: JSON.parse(el.path), set: {placeholder: '…'}})");
      }
      if (handle.textPath === undefined) {
        return fail(`element ${id} mixes text and children; target its child: ck.find({section:'${section}', kind:'text'})`);
      }
      out.push({
        tool: 'patchTreeNode',
        step: step('patchTreeNode', { id: handle.nodeId, path: [...handle.textPath], set: { text: value.text } }),
      });
    }
    const attributes: Record<string, string> = {};
    for (const key of ['href', 'src', 'alt'] as const) {
      const entry = value[key];
      if (entry !== undefined) attributes[key] = entry;
    }
    if (Object.keys(attributes).length > 0) {
      out.push({ tool: 'element.attr', step: tool('element.attr', { id: handle.nodeId, path, set: attributes }) });
    }
    return { ok: true, steps: out };
  }
  // A part of a registered block.
  const address = { id: handle.nodeId, part: handle.part ?? '', ...partIndex(handle.index) };
  if (kind === 'image') {
    if (value.text !== undefined || value.href !== undefined) {
      return fail(`"${handle.part ?? ''}" is an image; set {src, alt} on it`);
    }
    return {
      ok: true,
      steps: [{ tool: 'part.image', step: tool('part.image', { ...address, ...(value.src === undefined ? {} : { src: value.src }), ...(value.alt === undefined ? {} : { alt: value.alt }) }) }],
    };
  }
  if (value.src !== undefined || value.alt !== undefined) {
    return fail(`"${handle.part ?? ''}" is not an image; set {src, alt} on an image from ck.find({kind:'image'})`);
  }
  if (kind === 'link' || kind === 'button') {
    return {
      ok: true,
      steps: [{ tool: 'part.link', step: tool('part.link', { ...address, ...(value.text === undefined ? {} : { text: value.text }), ...(value.href === undefined ? {} : { href: value.href }) }) }],
    };
  }
  if (value.href !== undefined) {
    return fail(`"${handle.part ?? ''}" is text without a link; set href on a link or button from ck.find({kind:['link','button']})`);
  }
  if (kind === 'item' || kind === 'card') {
    if (handle.textPart === undefined) {
      return fail(`${kind} ${id} holds several texts; target one of them: ck.find({section:'${section}', kind:['heading','text']})`);
    }
    return {
      ok: true,
      steps: [{ tool: 'part.text', step: tool('part.text', { id: handle.nodeId, part: handle.textPart, ...partIndex(handle.index), text: value.text ?? '' }) }],
    };
  }
  return { ok: true, steps: [{ tool: 'part.text', step: tool('part.text', { ...address, text: value.text ?? '' }) }] };
}

// ── style ─────────────────────────────────────────────────────────────────────

function treeStyle(nodeId: string, path: readonly number[], entries: readonly StyleEntry[]): AgentToolStep {
  return tool('element.style', {
    id: nodeId,
    path: [...path],
    styles: entries.map((entry) => ({ ...entry })),
  });
}

function partStyle(nodeId: string, part: string, index: readonly number[] | undefined, entries: readonly StyleEntry[]): AgentToolStep {
  const style: JsonRecord = {};
  for (const entry of entries) {
    style[entry.property] =
      entry.bucket === undefined && entry.state === undefined
        ? entry.value
        : {
            value: entry.value,
            ...(entry.bucket === undefined ? {} : { bucket: entry.bucket }),
            ...(entry.state === undefined ? {} : { state: entry.state }),
          };
  }
  return tool('part.style', { id: nodeId, part, ...partIndex(index), style });
}

function styleSteps(
  call: ScriptCall & { op: 'style' },
  handle: Handle,
): { ok: true; steps: { tool: string; step: AgentToolStep }[] } | { ok: false; error: ScriptError } {
  if (handle.type === 'tree' || (handle.type === 'section' && handle.path !== undefined)) {
    const styles = readStyles(call, 'element.style');
    if (!styles.ok) return styles;
    return { ok: true, steps: [{ tool: 'element.style', step: treeStyle(handle.nodeId, handle.path ?? [], styles.entries) }] };
  }
  if (handle.part !== undefined) {
    const styles = readStyles(call, 'part.style');
    if (!styles.ok) return styles;
    return {
      ok: true,
      steps: [{ tool: 'part.style', step: partStyle(handle.nodeId, handle.part, handle.type === 'part' ? handle.index : undefined, styles.entries) }],
    };
  }
  return {
    ok: false,
    error: badTarget(
      call,
      `section "${handle.nodeId}" has no root part to style; use ck.tool('theme.apply', {...}) or style one part: ck.find({section:'${handle.nodeId}'})`,
    ),
  };
}

// ── tool ──────────────────────────────────────────────────────────────────────

function pageOf(name: string, ctx: WriteMapContext): string | undefined {
  if (name === ctx.currentPage) return name;
  const pages = ctx.pages ?? [];
  const bare = name.replace(/^\/+/u, '');
  return pages.find((page) => page.id === name)?.id ?? pages.find((page) => page.slug.replace(/^\/+/u, '') === bare)?.id;
}

// ── Calls ─────────────────────────────────────────────────────────────────────

/** Map every queued call to tool steps, grouped by page. The first error stops the mapping. */
export function callsToSteps(
  calls: readonly ScriptCall[],
  handles: ReadonlyMap<string, Handle>,
  ctx: WriteMapContext,
): CallMapResult {
  const byPage = new Map<string, MappedStep[]>();
  const add = (pageId: string, mapped: MappedStep): void => {
    const list = byPage.get(pageId);
    if (list === undefined) byPage.set(pageId, [mapped]);
    else list.push(mapped);
  };
  let targets = 0;
  for (const call of calls) {
    const where = call.line === undefined ? {} : { line: call.line };
    if (call.op === 'tool') {
      if (!ctx.tools.includes(call.name)) return { ok: false, error: noToolError(call.n, call.line, call.name, ctx.tools) };
      const definition = agentTool(call.name);
      if (definition === undefined) return { ok: false, error: noToolError(call.n, call.line, call.name, ctx.tools) };
      const parsed = definition.parse(call.input);
      if (!parsed.ok) return { ok: false, error: toolInputError(call.n, call.line, call.name, parsed.error) };
      let pageId = ctx.currentPage;
      if (call.page !== undefined && call.page !== '') {
        const found = pageOf(call.page, ctx);
        if (found === undefined) {
          if (!ctx.site) return { ok: false, error: otherPageError(ctx.pageName ?? ctx.currentPage, call.line) };
          const listed = (ctx.pages ?? []).map((page) => page.id).join(', ');
          return { ok: false, error: toolInputError(call.n, call.line, call.name, `no page "${call.page}"; pages: ${listed}.`) };
        }
        pageId = found;
      }
      if (pageId !== ctx.currentPage && !ctx.site) return { ok: false, error: otherPageError(ctx.pageName ?? ctx.currentPage, call.line) };
      add(pageId, {
        n: call.n,
        ...where,
        origin: 'tool',
        tool: call.name,
        step: { command: AGENT_TOOL_COMMAND, args: { name: call.name, input: call.input } },
      });
      continue;
    }
    const value = call.op === 'set' ? readSetValue(call) : undefined;
    if (value !== undefined && !value.ok) return { ok: false, error: value.error };
    for (const target of call.targets) {
      targets += 1;
      const handle = handles.get(target);
      if (handle === undefined) {
        return { ok: false, error: badTarget(call, `"${target.slice(0, 80)}" is not an element from ck.find()`) };
      }
      if (handle.pageId !== ctx.currentPage && !ctx.site) return { ok: false, error: otherPageError(ctx.pageName ?? ctx.currentPage, call.line) };
      const mapped =
        call.op === 'set' && value?.ok === true ? setSteps(call, target, handle, value.value) : call.op === 'style' ? styleSteps(call, handle) : undefined;
      /* v8 ignore next -- every op is handled above. */
      if (mapped === undefined) continue;
      if (!mapped.ok) return { ok: false, error: mapped.error };
      for (const produced of mapped.steps) {
        add(handle.pageId, {
          n: call.n,
          ...where,
          origin: call.op,
          tool: produced.tool,
          step: produced.step,
          ...(handle.kind === undefined ? {} : { kind: handle.kind }),
        });
      }
    }
  }
  return { ok: true, byPage, targets };
}
