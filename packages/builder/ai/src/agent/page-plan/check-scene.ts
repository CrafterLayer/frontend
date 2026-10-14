import {
  customCodeAttributeSpelling,
  scanLibKeys,
  scriptCodeIssues,
  STUDIO_LIB_KEYS,
  type JsonValue,
  type ScriptCodeIssue,
} from '@craftkit/builder-schema';

import { walkLandedTree } from './check-section';
import { cleanupFindings, guardFindings } from './scene-lifecycle';
import { levelFindings } from './scene-levels';
import {
  closingParen,
  finding,
  isPageTarget,
  literalsWithin,
  matchesOf,
  readSceneSource,
  receiverOf,
  type SceneLiteral,
  type SceneSource,
} from './scene-source';
import type { LandedSection, SectionCheckIssue } from './types';

/**
 * The scene check (creative-power Phase 1 B, 2026-10-12): a section's page
 * code — the customCode `js` stories, murals and games are written in — read
 * BEFORE it lands, beside `checkSection`, so what it finds goes to the same
 * one repair round. Until now the door checked only the code's length and
 * `</script`, and a scene that threw reached the canvas as a
 * `data-ck-js-error` nothing in the app reads.
 *
 * Each issue is phrased as the instruction that fixes it, with the line when
 * one is known (`path: 'js line 12'`). Every rule stays silent on the code the
 * agent is TAUGHT (the creative skills' and the free-code card's examples —
 * check-scene.test.ts runs them all); a rule that cannot be sure says nothing.
 * Never throws: the caller guards it anyway.
 */

export interface CheckSceneOptions {
  /** Ids other sections carry (their anchors): a page-level lookup may find those. */
  readonly pageIds?: readonly string[];
}

const MAX_SCENE_ISSUES = 8;
const KNOWN_LIBS = STUDIO_LIB_KEYS.join(', ');

// ── What the Studio lint already finds (syntax, libraries, banned calls) ──────

function lintFinding(entry: ScriptCodeIssue, code: string): SectionCheckIssue | undefined {
  const where = entry.line === undefined ? {} : { path: `js line ${String(entry.line)}` };
  switch (entry.code) {
    case 'syntax': {
      const detail = entry.message.en.replace(/^Syntax error(?: \([^)]*\))?: /u, '');
      return {
        code: 'scene-syntax',
        message: `Fix the syntax error${entry.line === undefined ? '' : ` at line ${String(entry.line)}${entry.column === undefined ? '' : `, column ${String(entry.column)}`}`}: ${detail}. The js is the body of async (ck)=>{…} and must parse on its own — balanced brackets and quotes, no import or export.`,
        ...where,
      };
    }
    case 'unknown-lib':
      return {
        code: 'scene-lib',
        message: `Name only libraries the runtime ships in libs / ck.use (${KNOWN_LIBS}): ${scanLibKeys(
          code,
        )
          .unknown.map((key) => `"${key}"`)
          .join(', ')} is not one — remove it, or use the library that does that job.`,
      };
    case 'dynamic-lib':
      return {
        code: 'scene-lib',
        message:
          "Write the library keys literally — ck.scene({libs:['fx']}), ck.use('physics'): the published page finds them by reading the code, so a computed key never loads.",
      };
    case 'eval':
      return {
        code: 'scene-forbidden',
        message: 'Remove eval(): a region script may not run strings as code.',
        ...where,
      };
    case 'document-write':
      return {
        code: 'scene-forbidden',
        message:
          'Draw inside ck.root instead of calling document.write(), which a region script may not use.',
        ...where,
      };
    case 'local-storage':
      return {
        code: 'scene-forbidden',
        message:
          'Remove localStorage: a page script keeps no state in the visitor’s browser — keep it in a variable, or read settings through ck.params.',
        ...where,
      };
    case 'arabic-split':
      return {
        code: 'scene-text',
        message:
          'Keep Arabic text whole: split into letters it loses its joined forms. Use s.words(text) or s.text(text), or move the whole line.',
        ...where,
      };
    default:
      // Length and `</script` are the door's to refuse; the switch is the composer's.
      return undefined;
  }
}

function lintFindings(code: string): readonly SectionCheckIssue[] {
  let found: readonly ScriptCodeIssue[];
  try {
    found = scriptCodeIssues(code, { switchOn: true });
  } catch {
    return [];
  }
  return found.flatMap((entry) => lintFinding(entry, code) ?? []);
}

// ── What the runtime owns: the app, the modules, the libraries' addresses ─────

const OWN_APP = /\bnew\s+(?:[\w$]+\s*\.\s*)?Application\s*\(/gu;
const IMPORT = /(?<![\w$.])(?:import(?![\w$])\s*[(\w$*{'"`]|require\s*\()/gu;
const CDN_HOST =
  /\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|esm\.sh|cdn\.skypack\.dev|ga\.jspm\.io|jspm\.dev|cdn\.pixijs\.com|pixijs\.download)\b|^https?:\/\/[^\s'"`]+\.m?js(?:[?#]|$)/iu;
const SCRIPT_ELEMENT = /createElement\s*\(\s*$/u;

function forbiddenFindings(source: SceneSource): readonly SectionCheckIssue[] {
  const findings: SectionCheckIssue[] = [];
  const app = matchesOf(source, OWN_APP)[0];
  if (app !== undefined) {
    findings.push(
      finding(
        'scene-forbidden',
        'Use the stage the runtime made — const {PIXI,app,canvas}=await ck.stage(), or const s=await ck.scene({…}) — instead of a new Application: the runtime owns the app, sizes it to the region and destroys it.',
        source,
        app.index,
      ),
    );
  }
  const imported = matchesOf(source, IMPORT)[0];
  if (imported !== undefined) {
    findings.push(
      finding(
        'scene-forbidden',
        'Remove the import: the js is a function body and loads no modules. Pixi is await ck.pixi() or ck.stage(); a library comes from ck.scene({libs:[…]}) as s.lib.<key>.',
        source,
        imported.index,
      ),
    );
  }
  const cdn = source.literals.find(
    ({ text, start }) =>
      CDN_HOST.test(text) ||
      (/^script$/iu.test(text) && SCRIPT_ELEMENT.test(source.bare.slice(0, start))),
  );
  if (cdn !== undefined) {
    findings.push(
      finding(
        'scene-forbidden',
        'Remove the CDN script: the page loads no code from an address — Pixi comes from ck.stage() or ck.pixi(), and every library from ck.scene({libs:[…]}).',
        source,
        cdn.start,
      ),
    );
  }
  return findings;
}

// ── Libraries: what `s.lib` holds is what `libs` lists ────────────────────────

const LIBS_LIST = /\blibs\s*:\s*\[/gu;
const LIB_USE = /\.\s*lib\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(?=['"`]))/gu;

function libFindings(source: SceneSource): readonly SectionCheckIssue[] {
  const listed = new Set<string>();
  for (const match of matchesOf(source, LIBS_LIST)) {
    const open = match.index + match[0].length - 1;
    const close = source.bare.indexOf(']', open);
    for (const { text } of literalsWithin(
      source,
      open,
      close === -1 ? source.bare.length : close,
    )) {
      listed.add(text.trim());
    }
  }
  // mural kit (2026-10-14): the runtime loads s.lib.anim with s.lib.mural (the kit tells its beats
  // on it), so a scene that lists 'mural' may use s.lib.anim without listing it.
  if (listed.has('mural')) listed.add('anim');
  const findings: SectionCheckIssue[] = [];
  const seen = new Set<string>();
  for (const match of matchesOf(source, LIB_USE)) {
    const end = match.index + match[0].length;
    const key =
      match[1] ?? source.literals.find(({ start }) => start === end)?.text.trim() ?? undefined;
    if (key === undefined || key === '' || listed.has(key) || seen.has(key)) continue;
    seen.add(key);
    const known = (STUDIO_LIB_KEYS as readonly string[]).includes(key) && key !== 'kit';
    findings.push(
      finding(
        'scene-lib',
        known
          ? `List '${key}' in the scene's libs — write ck.scene({libs:['${key}', …]}): the code uses s.lib.${key}, but s.lib holds only the libraries ck.scene lists, so it is undefined.`
          : `s.lib.${key} is not a library: s.lib holds only what ck.scene({libs:[…]}) lists, from ${KNOWN_LIBS} (the kit's helpers are on s itself). Use one of those, or draw it with s.PIXI.`,
        source,
        match.index,
      ),
    );
  }
  return findings;
}

// ── DOM lookups the section's tree cannot answer ─────────────────────────────

const LOOKUP = /\.\s*(querySelectorAll|querySelector|closest|matches|getElementById)\s*\(/gu;
const ATTRIBUTE_NAME = /\[\s*([A-Za-z_][\w-]*)/gu;
const ID_NAME = /#([A-Za-z_][\w-]*)/gu;
const BARE_ID = /^[A-Za-z_][\w-]*$/u;

interface TreeFacts {
  readonly attributes: ReadonlySet<string>;
  readonly ids: ReadonlySet<string>;
  /** A component reference renders markup the tree does not spell out. */
  readonly opaque: boolean;
  readonly heights: readonly string[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function treeFacts(tree: JsonValue): TreeFacts {
  const attributes = new Set<string>();
  const ids = new Set<string>();
  const heights: string[] = [];
  let opaque = false;
  for (const { node } of walkLandedTree(tree)) {
    if (node['kind'] === 'component' || typeof node['component'] === 'string') opaque = true;
    const own = node['attributes'];
    if (isRecord(own)) {
      for (const [name, value] of Object.entries(own)) {
        attributes.add(name.toLowerCase());
        if (name === 'id' && typeof value === 'string') ids.add(value.trim());
        if (name === 'style' && typeof value === 'string') heights.push(`{${value}}`);
      }
    }
    if (typeof node['className'] === 'string') heights.push(node['className']);
  }
  return { attributes, ids, opaque, heights };
}

function camel(attribute: string): string {
  return attribute
    .slice('data-'.length)
    .replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function domFindings(
  source: SceneSource,
  tree: JsonValue,
  options: CheckSceneOptions,
): readonly SectionCheckIssue[] {
  const lookups: { name: string; id: boolean; index: number; literal: SceneLiteral }[] = [];
  for (const match of matchesOf(source, LOOKUP)) {
    const method = match[1] ?? '';
    const open = match.index + match[0].length - 1;
    // A lookup on the page may find another section's anchor; its data attributes are not ours.
    const page =
      method === 'getElementById' || isPageTarget(receiverOf(source.bare, match.index + 1));
    for (const literal of literalsWithin(source, open, closingParen(source.bare, open))) {
      if (method === 'getElementById') {
        const id = literal.text.trim();
        if (BARE_ID.test(id) && !(options.pageIds ?? []).includes(id)) {
          lookups.push({ name: id, id: true, index: literal.start, literal });
        }
        continue;
      }
      for (const [, name = ''] of literal.text.matchAll(ATTRIBUTE_NAME)) {
        const attribute = name.toLowerCase();
        if (!page && attribute.startsWith('data-') && !attribute.startsWith('data-ck-')) {
          lookups.push({ name: attribute, id: false, index: literal.start, literal });
        }
      }
      // An id inside an attribute value (`[href="#top"]`) is not an id lookup.
      for (const [, id = ''] of literal.text.replace(/\[[^\]]*\]?/gu, ' ').matchAll(ID_NAME)) {
        if (!page || !(options.pageIds ?? []).includes(id)) {
          lookups.push({ name: id, id: true, index: literal.start, literal });
        }
      }
    }
  }
  if (lookups.length === 0) return [];
  const facts = treeFacts(tree);
  if (facts.opaque) return [];
  const queried = new Set(lookups.map(({ literal }) => literal));
  /** The code writes it itself: in markup, `setAttribute`, an id, or a dataset assignment. */
  const madeByCode = (name: string, id: boolean): boolean =>
    source.literals.some((literal) => !queried.has(literal) && literal.text.includes(name)) ||
    (!id && new RegExp(`\\.\\s*dataset\\s*\\.\\s*${camel(name)}\\s*=(?!=)`, 'u').test(source.bare));
  const findings: SectionCheckIssue[] = [];
  const reported = new Set<string>();
  for (const { name, id, index } of lookups) {
    const key = `${id ? '#' : ''}${name}`;
    if (reported.has(key) || madeByCode(name, id)) continue;
    // The door drops a data attribute it does not know (2026-10-12): the tree can never hold it.
    const kept = id || customCodeAttributeSpelling(name) === name;
    if (kept && (id ? facts.ids.has(name) : facts.attributes.has(name))) continue;
    reported.add(key);
    if (!kept) {
      findings.push(
        finding(
          'scene-dom',
          `Name the hook data-scene-action, data-scene-key, data-scene-status, data-scene-part or data-scene-value (or a playbook's own, like data-game-action): the code queries [${name}], and the page never keeps that attribute — the tree door drops data attributes it does not know.`,
          source,
          index,
        ),
      );
      continue;
    }
    findings.push(
      finding(
        'scene-dom',
        id
          ? `Give an element in the section's tree id="${name}", or look up one it has: the code finds #${name}, nothing in the section carries that id, so the lookup returns null.`
          : `Put ${name} on the element the code means in the section's tree, or look up an attribute it has: the code queries [${name}], no element in the tree carries it, so the lookup returns null.`,
        source,
        index,
      ),
    );
  }
  return findings;
}

// ── A scene fills its region: the region needs a height ──────────────────────

const OPENS_STAGE = /\bck\s*\.\s*(?:stage|scene)\s*\(/u;
const CSS_HEIGHT =
  /(?:^|[{;\s])(?:min-height|height|min-block-size|block-size|aspect-ratio)\s*:\s*(?!(?:auto|0|0px|initial|unset|inherit|none|fit-content|min-content|max-content)\s*(?:[;}!]|$))/imu;
const CLASS_HEIGHT =
  /^(?:[\w-]+:)*!?(?:min-h|h|size|aspect)-(?!(?:0|auto|px|fit|min|max|full)$)\S+$/u;

function heightFindings(source: SceneSource, section: LandedSection): readonly SectionCheckIssue[] {
  const opens = OPENS_STAGE.exec(source.bare);
  if (opens === null) return [];
  if (typeof section.css === 'string' && CSS_HEIGHT.test(section.css)) return [];
  const { heights } = treeFacts(section.tree);
  const sized = heights.some((value) =>
    value.startsWith('{')
      ? CSS_HEIGHT.test(value)
      : value.split(/\s+/u).some((name) => CLASS_HEIGHT.test(name)),
  );
  if (sized) return [];
  return [
    finding(
      'scene-height',
      "Give the region a height in its css — e.g. .ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px} on the section's element, or min-h-[420px] on it in the tree: the scene's canvas fills the region, and a region with no height draws a blank canvas.",
      source,
      opens.index,
    ),
  ];
}

// ── Dialogue read from the tree (T231, 2026-10-12): fromDom needs its list ──

const FROM_DOM = /\.\s*fromDom\s*\(/u;

function dialogueFindings(source: SceneSource, tree: JsonValue): readonly SectionCheckIssue[] {
  const call = FROM_DOM.exec(source.bare);
  if (call === null) return [];
  const facts = treeFacts(tree);
  const written = source.literals.some(({ text }) => text.includes('data-ck-dialogue'));
  if (facts.opaque || written || facts.attributes.has('data-ck-dialogue')) return [];
  return [
    finding(
      'scene-dom',
      "Put the dialogue's lines in the section's tree — <ol data-ck-dialogue hidden> with one <li> per line (data-ck-speaker, data-ck-node, data-ck-next, data-ck-ending; buttons with data-ck-next are its choices): the code reads them with fromDom, and no element in the tree carries data-ck-dialogue, so it throws.",
      source,
      call.index,
    ),
  ];
}

// ── Params: the region's jsParams reach the code only through ck.params ──────

const PARAMS_CALL = /\bck\s*\.\s*params\s*\(\s*/u;
const OBJECT_KEY = /[{,]\s*([A-Za-z_$][\w$]*)\s*:/gu;

function paramsFindings(
  source: SceneSource,
  jsParams: JsonValue | undefined,
): readonly SectionCheckIssue[] {
  if (!isRecord(jsParams)) return [];
  const given = Object.keys(jsParams);
  if (given.length === 0) return [];
  const call = PARAMS_CALL.exec(source.bare);
  const list = (keys: readonly string[]): string => keys.map((key) => `'${key}'`).join(', ');
  if (call === null) {
    return [
      finding(
        'scene-params',
        `Read the region's settings through ck.params: const p=ck.params({…}) with a default for ${list(given)} — the code never calls it, so those values never reach the scene.`,
      ),
    ];
  }
  const brace = call.index + call[0].length;
  if (source.bare[brace] !== '{') return [];
  const close = closingParen(source.bare, source.bare.indexOf('(', call.index));
  const object = source.bare.slice(brace, close);
  const declared = new Set([
    ...[...object.matchAll(OBJECT_KEY)].map(([, key = '']) => key),
    ...literalsWithin(source, brace, close).map(({ text }) => text),
  ]);
  const dropped = given.filter((key) => !declared.has(key));
  if (dropped.length === 0) return [];
  return [
    finding(
      'scene-params',
      `Give ${list(dropped)} a default in ck.params({…}): the runtime drops every setting the defaults do not name, so the region's value never reaches the scene.`,
      source,
      call.index,
    ),
  ];
}

/**
 * What is wrong with a section's scene, each finding the instruction that
 * fixes it. A section without code has nothing to check.
 */
export function checkScene(
  section: LandedSection,
  options: CheckSceneOptions = {},
): readonly SectionCheckIssue[] {
  const code = section.js;
  if (typeof code !== 'string' || code.trim() === '') return [];
  try {
    const source = readSceneSource(code);
    const findings = [
      ...lintFindings(code),
      ...forbiddenFindings(source),
      ...libFindings(source),
      ...domFindings(source, section.tree, options),
      ...dialogueFindings(source, section.tree),
      ...heightFindings(source, section),
      ...cleanupFindings(source),
      ...guardFindings(source),
      ...paramsFindings(source, section.jsParams),
      ...levelFindings(source),
    ];
    return Object.freeze(
      findings.slice(0, MAX_SCENE_ISSUES).map((entry) => Object.freeze({ ...entry })),
    );
  } catch {
    // A rule that throws finds nothing: the scene lands as written.
    return [];
  }
}
