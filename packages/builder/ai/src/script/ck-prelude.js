/**
 * The `ck` API a model's script sees (DESIGN §A.2.1, §A.4).
 *
 * `ckPrelude` is evaluated INSIDE QuickJS: sandbox-core embeds
 * `ckPrelude.toString()` into the wrapper source, so the function must be fully
 * SELF-CONTAINED: it may not reference anything at module scope (a test
 * asserts `new Function('return ' + ckPrelude.toString())()` works). It is plain
 * ES2022 so the same file loads in the Vite browser worker, the Node worker and
 * vitest, which calls it directly without wasm.
 *
 * Data in, data out: the host posts a JSON element index; every `ck.*` call is
 * answered from that index or queued as a ScriptCall; `finish` returns ONE JSON
 * string. No host function crosses the boundary.
 *
 * Contains an adapted copy of the structural truncation vendored in
 * `truncate.ts` from `@cloudflare/codemode@0.5.3` (MIT, Copyright (c) 2025
 * Cloudflare, Inc. — the full notice is in truncate.ts). A parity test keeps
 * the two copies byte-identical in output.
 */

/** Lines QuickJS (and V8) put above a `new Function` body: user line = engine line - 2. */
export const CK_USER_LINE_OFFSET = 2;

/**
 * Build the frozen `ck` API and its private state.
 *
 * @param {import('./ck-prelude').CkPreludeInput} input
 * @returns {import('./ck-prelude').CkPrelude}
 */
export function ckPrelude(input) {
  'use strict';

  // ---- intrinsics, captured before the script can replace them --------------
  const G = globalThis;
  const freeze = Object.freeze;
  const defineProperty = Object.defineProperty;
  const objectKeys = Object.keys;
  const createObject = Object.create;
  const isArray = Array.isArray;
  const stringify = JSON.stringify;
  const parseJson = JSON.parse;
  const MathObject = Math;
  const imul = Math.imul;
  const floor = Math.floor;
  const min = Math.min;
  const max = Math.max;
  const isFiniteNumber = Number.isFinite;
  const isInteger = Number.isInteger;
  const StringOf = String;
  const NumberOf = Number;
  const ErrorCtor = Error;
  const TypeErrorCtor = TypeError;
  const RealDate = G.Date;
  const realRandom = MathObject.random;
  const MARK = Symbol('ck.error');

  const LINE_OFFSET = 2;
  const LIMITS = input.limits;
  const KINDS = [
    'section',
    'heading',
    'text',
    'button',
    'link',
    'image',
    'icon',
    'card',
    'item',
    'input',
    'video',
  ];
  const FIND_KEYS = ['kind', 'text', 'section', 'page'];
  const SET_KEYS = ['text', 'href', 'src', 'alt'];
  const BUCKETS = ['base', 'tablet', 'mobile'];
  const SCRIPT_TOOL = 'script.run';
  const CURRENCIES = {
    JOD: 'د.أ',
    SAR: 'ر.س',
    AED: 'د.إ',
    EGP: 'ج.م',
    KWD: 'د.ك',
    QAR: 'ر.ق',
    BHD: 'د.ب',
    OMR: 'ر.ع',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  const PREFIX_SYMBOL = { USD: true, EUR: true, GBP: true };
  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const TRUNCATION_MARKER = '--- TRUNCATED ---';
  const MIN_SLOT = 128;

  // ---- Arabic-aware matching -----------------------------------------------
  // Parity with script-host's `norm` (element-index.ts): normalizeArabic(text).toLowerCase()
  // from intent/normalize-arabic.ts. A parity test pins it.
  const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/gu;
  const ALIFS = /[\u0622\u0623\u0625\u0671\u0672\u0673]/gu;

  function normalize(text) {
    return StringOf(text)
      .replace(MARKS, '')
      .replace(ALIFS, '\u0627')
      .replace(/\u0629/gu, '\u0647')
      .replace(/\u0649/gu, '\u064A')
      .replace(/\u06CC/gu, '\u064A')
      .replace(/\u06A9/gu, '\u0643')
      .toLowerCase();
  }

  // ---- determinism: seeded Math.random, frozen Date ------------------------
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function random() {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = imul(t ^ (t >>> 15), 1 | t);
      r = (r + imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  const seed = NumberOf(input.seed) >>> 0 || 0;
  const frozenNow = isFiniteNumber(input.now) ? input.now : 0;

  function FrozenDate(...args) {
    if (new.target === undefined) return new RealDate(frozenNow).toString();
    return args.length === 0 ? new RealDate(frozenNow) : new RealDate(...args);
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = function now() {
    return frozenNow;
  };
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  MathObject.random = mulberry32(seed);
  G.Date = FrozenDate;

  function restore() {
    MathObject.random = realRandom;
    G.Date = RealDate;
  }

  // ---- the index ------------------------------------------------------------
  const elements = [];
  const byId = createObject(null);
  for (const raw of input.elements || []) {
    const el = freeze(
      typeof raw.norm === 'string'
        ? raw
        : Object.assign({}, raw, { norm: normalize(raw.text || '') }),
    );
    elements[elements.length] = el;
    byId[el.id] = el;
  }
  const pageList = [];
  let currentPage;
  for (const page of input.pages || []) {
    const frozen = freeze(Object.assign({}, page));
    pageList[pageList.length] = frozen;
    if (frozen.current && currentPage === undefined) currentPage = frozen.id;
  }
  const photoList = input.photos || [];
  const toolNames = [];
  const toolSet = createObject(null);
  for (const name of input.tools || []) {
    if (typeof name === 'string' && name !== SCRIPT_TOOL && !toolSet[name]) {
      toolSet[name] = true;
      toolNames[toolNames.length] = name;
    }
  }
  const locale = input.locale || { lang: 'en', dir: 'ltr' };
  const arabicPage = /^ar\b/iu.test(StringOf(locale.lang || ''));
  const sectionNorms = createObject(null);

  // ---- state ----------------------------------------------------------------
  const state = {
    calls: 0,
    steps: 0,
    targets: 0,
    found: 0,
    lastTruncated: false,
    truncationNoted: false,
    error: undefined,
    queued: [],
    notes: [],
    photoCursor: createObject(null),
  };

  // ---- errors ---------------------------------------------------------------
  function lineFromStack(stack) {
    if (typeof stack !== 'string') return undefined;
    // QuickJS names a `new Function` body `<input>`; V8 (vitest) names it `<anonymous>`.
    const match = /<input>:(\d+)/u.exec(stack) || /<anonymous>:(\d+):\d+\)/u.exec(stack);
    if (match === null) return undefined;
    const line = NumberOf(match[1]) - LINE_OFFSET;
    return line >= 1 ? line : undefined;
  }

  function callerLine() {
    try {
      return lineFromStack(new ErrorCtor('ck').stack);
    } catch {
      return undefined;
    }
  }

  /** A prelude error: always sticky, so catching it in the script cannot hide it. */
  function coded(code, detail) {
    if (state.error === undefined) state.error = { code, detail };
    const error = new ErrorCtor(code);
    error[MARK] = state.error;
    return error;
  }

  function capText(text, limit) {
    const s = StringOf(text);
    return s.length > limit ? s.slice(0, limit - 1) + '…' : s;
  }

  function addNote(text) {
    const clean = StringOf(text).replace(/\s+/gu, ' ').trim();
    if (clean === '' || state.notes.length >= LIMITS.maxNotes) return;
    state.notes[state.notes.length] = capText(clean, LIMITS.maxNoteChars);
  }

  function enter() {
    if (state.error !== undefined) throw coded(state.error.code, state.error.detail);
    state.calls += 1;
    if (state.calls > LIMITS.maxCalls) throw coded('E_LIMIT_CALLS', { line: callerLine() });
  }

  function queue(call, targetCount) {
    if (call.n > LIMITS.maxSteps || state.targets + targetCount > LIMITS.maxTargets) {
      throw coded('E_LIMIT_STEPS', { n: call.n, line: call.line });
    }
    state.steps = call.n;
    state.targets += targetCount;
    state.queued[state.queued.length] = freeze(call);
  }

  function describe(value) {
    if (value === undefined) return 'undefined (check the index you used)';
    if (value === null) return 'null';
    if (typeof value === 'string') return '"' + capText(value, 60) + '"';
    if (typeof value === 'object') {
      return (
        'an object without a known id' +
        (typeof value.id === 'string' ? ' ("' + capText(value.id, 60) + '")' : '')
      );
    }
    return 'a ' + typeof value;
  }

  function resolveTargets(target, n, line) {
    const list = isArray(target) ? target : [target];
    const out = [];
    const seen = createObject(null);
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      let id;
      if (typeof item === 'string') id = item;
      else if (item !== null && typeof item === 'object' && typeof item.id === 'string')
        id = item.id;
      if (id === undefined || byId[id] === undefined) {
        const where = list === target ? 'target ' + StringOf(i + 1) : 'the target';
        throw coded('E_BAD_TARGET', {
          n,
          line,
          message: where + ' is ' + describe(item) + ', not an element from ck.find()',
        });
      }
      if (!seen[id]) {
        seen[id] = true;
        out[out.length] = id;
      }
    }
    return out;
  }

  function resolvePage(ref, label) {
    const wanted = StringOf(ref);
    for (const page of pageList) {
      if (page.id === wanted || page.slug === wanted || '/' + page.slug === wanted) return page.id;
    }
    const names = [];
    for (const page of pageList) names[names.length] = page.slug || page.id;
    throw new TypeErrorCtor(
      label +
        ': no page "' +
        capText(wanted, 60) +
        '". Pages: ' +
        (names.join(', ') || '(only this one)'),
    );
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !isArray(value);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let previous = [];
    for (let j = 0; j <= b.length; j += 1) previous[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      }
      previous = current;
    }
    return previous[b.length];
  }

  function didYouMean(name, valid) {
    const needle = StringOf(name).toLowerCase();
    let best;
    let bestDistance = 4;
    for (const candidate of valid) {
      const distance = levenshtein(needle, candidate.toLowerCase());
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  // ---- reads ----------------------------------------------------------------
  function find(query) {
    enter();
    const q = query === undefined || query === null ? {} : query;
    if (!isPlainObject(q)) throw new TypeErrorCtor('ck.find takes {kind?, text?, section?, page?}');
    for (const key of objectKeys(q)) {
      if (FIND_KEYS.indexOf(key) === -1) {
        throw new TypeErrorCtor(
          'ck.find: unknown filter "' + capText(key, 40) + '"; use kind, text, section, page',
        );
      }
    }
    let kinds;
    if (q.kind !== undefined && q.kind !== null) {
      kinds = isArray(q.kind) ? q.kind : [q.kind];
      for (const kind of kinds) {
        if (KINDS.indexOf(kind) === -1) {
          throw new TypeErrorCtor(
            'ck.find: unknown kind "' + capText(kind, 40) + '"; kinds: ' + KINDS.join(', '),
          );
        }
      }
    }
    const text = q.text === undefined || q.text === null ? '' : normalize(q.text).trim();
    const sectionRaw =
      q.section === undefined || q.section === null ? undefined : StringOf(q.section);
    const sectionQuery = sectionRaw === undefined ? undefined : normalize(sectionRaw).trim();
    let pageId = currentPage;
    if (q.page === '*') pageId = undefined;
    else if (q.page !== undefined && q.page !== null) pageId = resolvePage(q.page, 'ck.find');

    const out = [];
    let total = 0;
    for (const el of elements) {
      if (pageId !== undefined && el.page !== pageId) continue;
      if (kinds !== undefined && kinds.indexOf(el.kind) === -1) continue;
      if (text !== '' && el.norm.indexOf(text) === -1) continue;
      if (sectionRaw !== undefined && el.sectionId !== sectionRaw) {
        let label = sectionNorms[el.section];
        if (label === undefined) {
          label = normalize(el.section || '');
          sectionNorms[el.section] = label;
        }
        if (label.indexOf(sectionQuery) === -1) continue;
      }
      total += 1;
      if (out.length < LIMITS.maxFind) out[out.length] = el;
    }
    state.lastTruncated = total > out.length;
    if (state.lastTruncated && !state.truncationNoted) {
      state.truncationNoted = true;
      addNote(
        'find() returned the first ' + StringOf(LIMITS.maxFind) + '; narrow with page/section/kind',
      );
    }
    state.found += out.length;
    return out;
  }
  defineProperty(find, 'truncated', {
    enumerable: true,
    get() {
      return state.lastTruncated;
    },
  });

  function pages() {
    enter();
    return pageList.slice();
  }

  function photoMatches(photo, topic) {
    const photoTopic = normalize(photo.topic || '');
    if (
      photoTopic === topic ||
      photoTopic.replace(/[\s_-]+/gu, '') === topic.replace(/[\s_-]+/gu, '')
    )
      return true;
    const words = normalize(photo.alt || '').split(/[^\p{L}\p{N}]+/u);
    return words.indexOf(topic) !== -1;
  }

  function photos(topic, count) {
    enter();
    let n = count === undefined || count === null ? 6 : NumberOf(count);
    if (!isFiniteNumber(n) || n < 1)
      throw new TypeErrorCtor('ck.photos(topic, n): n is a number from 1 to 24');
    n = min(24, floor(n));
    if (photoList.length === 0) return [];
    let pool = photoList;
    let key = '*';
    if (topic !== undefined && topic !== null && StringOf(topic).trim() !== '') {
      key = normalize(topic);
      pool = [];
      for (const photo of photoList) if (photoMatches(photo, key)) pool[pool.length] = photo;
      if (pool.length === 0) {
        const topics = [];
        for (const photo of photoList)
          if (topics.indexOf(photo.topic) === -1) topics[topics.length] = photo.topic;
        throw new TypeErrorCtor(
          'ck.photos: no photos for "' + capText(topic, 40) + '". Topics: ' + topics.join(', '),
        );
      }
    }
    let cursor = state.photoCursor[key];
    if (cursor === undefined)
      cursor = floor(mulberry32((seed ^ hashString(key)) >>> 0)() * pool.length);
    const take = min(n, pool.length);
    const out = [];
    for (let i = 0; i < take; i += 1) {
      const photo = pool[(cursor + i) % pool.length];
      out[i] = freeze({ src: photo.src, alt: photo.alt });
    }
    state.photoCursor[key] = (cursor + take) % pool.length;
    return out;
  }

  // ---- writes ---------------------------------------------------------------
  function set(target, value) {
    enter();
    const line = callerLine();
    const n = state.steps + 1;
    const targets = resolveTargets(target, n, line);
    if (!isPlainObject(value)) {
      throw new TypeErrorCtor(
        'ck.set(el, {text?, href?, src?, alt?}) needs an object as its second argument',
      );
    }
    const fields = {};
    let any = false;
    for (const key of objectKeys(value)) {
      if (SET_KEYS.indexOf(key) === -1) {
        throw new TypeErrorCtor(
          'ck.set: unknown field "' +
            capText(key, 40) +
            '"; use text, href, src, alt (styles go through ck.style)',
        );
      }
      const v = value[key];
      if (v === undefined) continue;
      if (typeof v !== 'string' && typeof v !== 'number')
        throw new TypeErrorCtor('ck.set: ' + key + ' must be a string');
      fields[key] = StringOf(v);
      any = true;
    }
    if (!any) throw new TypeErrorCtor('ck.set: give at least one of text, href, src, alt');
    if (targets.length === 0) return 0;
    queue({ n, line, op: 'set', targets: freeze(targets), value: freeze(fields) }, targets.length);
    return targets.length;
  }

  function styleValue(key, value) {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
      if (typeof value === 'number' && !isFiniteNumber(value))
        throw new TypeErrorCtor('ck.style: ' + key + ' must be a finite number');
      return value;
    }
    if (isPlainObject(value)) {
      const v = value.value;
      if (!(v === null || typeof v === 'string' || (typeof v === 'number' && isFiniteNumber(v)))) {
        throw new TypeErrorCtor('ck.style: ' + key + '.value must be a string, a number or null');
      }
      const out = { value: v };
      if (value.bucket !== undefined) {
        if (BUCKETS.indexOf(value.bucket) === -1)
          throw new TypeErrorCtor('ck.style: bucket is base, tablet or mobile');
        out.bucket = value.bucket;
      }
      if (value.state !== undefined) out.state = StringOf(value.state);
      return freeze(out);
    }
    throw new TypeErrorCtor(
      'ck.style: ' + key + ' must be a string, a number, null or {value, bucket?, state?}',
    );
  }

  function style(target, styles, options) {
    enter();
    const line = callerLine();
    const n = state.steps + 1;
    const targets = resolveTargets(target, n, line);
    if (!isPlainObject(styles))
      throw new TypeErrorCtor("ck.style(el, {borderRadius:'full'}) needs a styles object");
    const keys = objectKeys(styles);
    if (keys.length === 0)
      throw new TypeErrorCtor("ck.style: give at least one style, e.g. {borderRadius:'full'}");
    const out = {};
    for (const key of keys) out[key] = styleValue(key, styles[key]);
    let opts;
    if (options !== undefined && options !== null) {
      if (!isPlainObject(options))
        throw new TypeErrorCtor('ck.style: options are {bucket?, state?}');
      opts = {};
      for (const key of objectKeys(options)) {
        if (key === 'bucket') {
          if (BUCKETS.indexOf(options.bucket) === -1)
            throw new TypeErrorCtor('ck.style: bucket is base, tablet or mobile');
          opts.bucket = options.bucket;
        } else if (key === 'state') {
          opts.state = StringOf(options.state);
        } else {
          throw new TypeErrorCtor(
            'ck.style: unknown option "' + capText(key, 40) + '"; options are {bucket?, state?}',
          );
        }
      }
      opts = freeze(opts);
    }
    if (targets.length === 0) return 0;
    const call = { n, line, op: 'style', targets: freeze(targets), styles: freeze(out) };
    if (opts !== undefined) call.options = opts;
    queue(call, targets.length);
    return targets.length;
  }

  function tool(name, toolInput, options) {
    enter();
    const line = callerLine();
    const n = state.steps + 1;
    if (typeof name !== 'string' || !toolSet[name]) {
      const detail = { n, line, name: capText(name, 80), tools: toolNames };
      const suggestion = didYouMean(StringOf(name), toolNames);
      if (suggestion !== undefined) detail.suggestion = suggestion;
      throw coded('E_NO_TOOL', detail);
    }
    let copy = {};
    if (toolInput !== undefined) {
      let text;
      try {
        text = stringify(toolInput);
      } catch {
        text = undefined;
      }
      if (text === undefined)
        throw new TypeErrorCtor(
          'ck.tool: input must be plain JSON data (no cycles, functions or BigInt)',
        );
      copy = parseJson(text);
    }
    const call = { n, line, op: 'tool', name, input: copy };
    if (options !== undefined && options !== null) {
      if (!isPlainObject(options)) throw new TypeErrorCtor('ck.tool: options are {page?}');
      for (const key of objectKeys(options)) {
        if (key !== 'page')
          throw new TypeErrorCtor(
            'ck.tool: unknown option "' + capText(key, 40) + '"; options are {page?}',
          );
      }
      if (options.page !== undefined && options.page !== null)
        call.page = resolvePage(options.page, 'ck.tool');
    }
    queue(call, 0);
    return n;
  }

  // ---- helpers: fmt + note ---------------------------------------------------
  function formatNumber(value, options, label) {
    const num = typeof value === 'string' && value.trim() !== '' ? NumberOf(value) : value;
    if (typeof num !== 'number' || !isFiniteNumber(num))
      throw new TypeErrorCtor('ck.fmt.' + label + ' needs a finite number');
    const opts = options === undefined || options === null ? {} : options;
    if (!isPlainObject(opts))
      throw new TypeErrorCtor('ck.fmt.' + label + ': options are {digits?, decimals?}');
    const digits = opts.digits === undefined ? 'latn' : opts.digits;
    if (digits !== 'latn' && digits !== 'arab')
      throw new TypeErrorCtor('ck.fmt.' + label + ": digits is 'arab' or 'latn'");
    let decimals = isInteger(num) ? 0 : 2;
    if (opts.decimals !== undefined) {
      decimals = NumberOf(opts.decimals);
      if (!isInteger(decimals) || decimals < 0 || decimals > 6)
        throw new TypeErrorCtor('ck.fmt.' + label + ': decimals is 0 to 6');
    }
    const arab = digits === 'arab';
    const fixed = (num < 0 ? -num : num).toFixed(decimals);
    const dot = fixed.indexOf('.');
    const whole = dot === -1 ? fixed : fixed.slice(0, dot);
    const fraction = dot === -1 ? '' : fixed.slice(dot + 1);
    let grouped = '';
    for (let i = 0; i < whole.length; i += 1) {
      if (i > 0 && (whole.length - i) % 3 === 0) grouped += arab ? '٬' : ',';
      grouped += whole[i];
    }
    let text = fraction === '' ? grouped : grouped + (arab ? '٫' : '.') + fraction;
    if (arab) text = text.replace(/[0-9]/gu, (d) => ARABIC_DIGITS[NumberOf(d)]);
    return num < 0 && NumberOf(fixed) !== 0 ? '-' + text : text;
  }

  function fmtNum(value, options) {
    enter();
    return formatNumber(value, options, 'num');
  }

  function fmtMoney(value, currency, options) {
    enter();
    const code = (
      currency === undefined || currency === null
        ? arabicPage
          ? 'JOD'
          : 'USD'
        : StringOf(currency)
    ).toUpperCase();
    const symbol = CURRENCIES[code];
    if (symbol === undefined) {
      throw new TypeErrorCtor(
        'ck.fmt.money: unknown currency "' +
          capText(currency, 20) +
          '"; use ' +
          objectKeys(CURRENCIES).join(', '),
      );
    }
    const opts = options === undefined || options === null ? {} : options;
    if (!isPlainObject(opts))
      throw new TypeErrorCtor('ck.fmt.money: options are {digits?, decimals?, lang?}');
    const lang = opts.lang === undefined ? (arabicPage ? 'ar' : 'en') : StringOf(opts.lang);
    const amount = formatNumber(value, { digits: opts.digits, decimals: opts.decimals }, 'money');
    if (/^ar\b/iu.test(lang)) return amount + ' ' + symbol;
    const negative = amount.charAt(0) === '-';
    const bare = negative ? amount.slice(1) : amount;
    if (PREFIX_SYMBOL[code]) return (negative ? '-' : '') + symbol + bare;
    return code + ' ' + amount;
  }

  function note(text) {
    enter();
    addNote(text);
  }

  // ---- result (structural truncation, adapted from truncate.ts) -------------
  function size(value) {
    return stringify(value).length;
  }
  function shrinkable(value) {
    return typeof value === 'string' || (typeof value === 'object' && value !== null);
  }
  function floorSize(value, maxChars) {
    const full = size(value);
    return shrinkable(value) ? min(full, MIN_SLOT, max(2, floor(maxChars / 2))) : full;
  }
  function shrink(value, maxChars) {
    if (size(value) <= maxChars) return value;
    if (typeof value === 'string') return shrinkString(value, maxChars);
    if (isArray(value)) return shrinkArray(value, maxChars);
    if (typeof value === 'object' && value !== null) return shrinkObject(value, maxChars);
    return value;
  }
  function shrinkString(value, maxChars) {
    const suffix = ' ' + TRUNCATION_MARKER + ' ' + StringOf(value.length) + ' chars';
    let keep = max(0, maxChars - suffix.length - 2);
    let out = value.slice(0, keep) + suffix;
    while (keep > 0 && size(out) > maxChars) {
      keep = max(0, keep - (size(out) - maxChars));
      out = value.slice(0, keep) + suffix;
    }
    return size(out) <= maxChars ? out : TRUNCATION_MARKER.slice(0, max(0, maxChars - 2));
  }
  function allocate(values, available) {
    const sizes = values.map(size);
    const order = sizes.map((_, index) => index).sort((a, b) => sizes[a] - sizes[b]);
    const allocation = new Array(values.length).fill(0);
    let remaining = available;
    let count = values.length;
    for (const index of order) {
      const alloc = min(sizes[index], floor(remaining / count));
      allocation[index] = alloc;
      remaining -= alloc;
      count -= 1;
    }
    return allocation;
  }
  function shrinkArray(items, maxChars) {
    const marker = (dropped) => TRUNCATION_MARKER + ' ' + StringOf(dropped) + ' more items';
    const floors = items.map((item) => floorSize(item, maxChars));
    const skeleton = (count) => 2 + max(0, count - 1);
    let keep = items.length;
    if (floors.reduce((n, f) => n + f, 0) + skeleton(keep) > maxChars) {
      const tail = size(marker(items.length)) + 1;
      let used = skeleton(0) + tail;
      keep = 0;
      while (keep < items.length && used + floors[keep] + 1 <= maxChars) {
        used += floors[keep] + 1;
        keep += 1;
      }
    }
    const kept = items.slice(0, keep);
    const dropped = items.length - keep;
    const tail = dropped > 0 ? size(marker(dropped)) + (keep > 0 ? 1 : 0) : 0;
    const allocation = allocate(kept, maxChars - skeleton(keep) - tail);
    const out = kept.map((item, index) => shrink(item, allocation[index]));
    if (dropped > 0 && size(out.concat([marker(dropped)])) <= maxChars) out.push(marker(dropped));
    return out;
  }
  function shrinkObject(value, maxChars) {
    const entries = Object.entries(value);
    let markerKey = TRUNCATION_MARKER;
    while (markerKey in value) markerKey += ' ';
    const keyCost = (key) => size(key) + 1;
    const floors = entries.map((entry) => keyCost(entry[0]) + floorSize(entry[1], maxChars));
    const floorOf = (chars) => min(chars, MIN_SLOT, max(2, floor(maxChars / 2)));
    const byValueSize = entries
      .map((_, index) => index)
      .sort((a, b) => size(entries[b][1]) - size(entries[a][1]));
    const dropped = new Set();
    let present = entries.length;
    let floorsSum = floors.reduce((n, f) => n + f, 0);
    let namesLength = 0;
    const noteLength = () =>
      (StringOf(dropped.size) + ' keys omitted: ').length + namesLength + 2 * (dropped.size - 1);
    const cost = () => {
      const marker = dropped.size > 0 ? keyCost(markerKey) + floorOf(noteLength() + 2) : 0;
      const count = present + (dropped.size > 0 ? 1 : 0);
      return 2 + max(0, count - 1) + floorsSum + marker;
    };
    for (const index of byValueSize) {
      if (cost() <= maxChars) break;
      dropped.add(index);
      present -= 1;
      floorsSum -= floors[index];
      namesLength += size(entries[index][0]) - 2;
    }
    const kept = entries.filter((_, index) => !dropped.has(index));
    const omitted = Array.from(dropped)
      .sort((a, b) => a - b)
      .map((index) => entries[index][0]);
    const omittedNote = StringOf(omitted.length) + ' keys omitted: ' + omitted.join(', ');
    if (cost() > maxChars) {
      const room = maxChars - 2 - keyCost(markerKey);
      const only = {};
      if (room >= 2) only[markerKey] = shrink(omittedNote, room);
      return only;
    }
    const all = kept.slice();
    if (omitted.length > 0) all.push([markerKey, omittedNote]);
    const fixed = 2 + max(0, all.length - 1) + all.reduce((n, entry) => n + keyCost(entry[0]), 0);
    const allocation = allocate(
      all.map((entry) => entry[1]),
      maxChars - fixed,
    );
    const out = {};
    all.forEach((entry, index) => {
      out[entry[0]] = shrink(entry[1], allocation[index]);
    });
    return out;
  }
  function truncateText(text, maxChars) {
    if (text.length <= maxChars) return text;
    const suffix = '\n' + TRUNCATION_MARKER + ' ' + StringOf(text.length) + ' chars';
    if (suffix.length >= maxChars) return TRUNCATION_MARKER.slice(0, max(0, maxChars));
    return text.slice(0, maxChars - suffix.length) + suffix;
  }
  function resultText(value, maxChars) {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return truncateText(value, maxChars);
    let serialized;
    try {
      serialized = stringify(value);
    } catch {
      return undefined;
    }
    if (serialized === undefined) return undefined;
    if (serialized.length <= maxChars) return serialized;
    const text = stringify(shrink(parseJson(serialized), maxChars));
    return text.length <= maxChars ? text : truncateText(serialized, maxChars);
  }

  // ---- finish / fail ----------------------------------------------------------
  function stats() {
    return { ms: 0, calls: state.calls, found: state.found };
  }

  function failJson(code, detail) {
    return stringify({
      ok: false,
      error: { code, detail: detail || {} },
      notes: state.notes,
      stats: stats(),
    });
  }

  function errorField(error, key) {
    try {
      return error !== null && (typeof error === 'object' || typeof error === 'function')
        ? error[key]
        : undefined;
    } catch {
      return undefined;
    }
  }

  function fail(error, phase) {
    if (state.error !== undefined) return failJson(state.error.code, state.error.detail);
    const mark = errorField(error, MARK);
    if (mark !== undefined) return failJson(mark.code, mark.detail);
    const name = StringOf(errorField(error, 'name') || '');
    const rawMessage = errorField(error, 'message');
    let message;
    try {
      message = capText(rawMessage === undefined ? StringOf(error) : StringOf(rawMessage), 300);
    } catch {
      message = 'the script threw a value that cannot be shown';
    }
    if (phase === 'compile' && name === 'SyntaxError') {
      const lineNumber = errorField(error, 'lineNumber');
      const columnNumber = errorField(error, 'columnNumber');
      const line =
        typeof lineNumber === 'number'
          ? lineNumber - LINE_OFFSET
          : lineFromStack(errorField(error, 'stack'));
      const detail = { message };
      if (line !== undefined && line >= 1) detail.line = line;
      if (typeof columnNumber === 'number') detail.col = columnNumber;
      return failJson('E_SYNTAX', detail);
    }
    if (name === 'InternalError' || name === 'RangeError') {
      if (/stack overflow|call stack size/iu.test(message)) return failJson('E_STACK', {});
      if (/out of memory|string too long/iu.test(message)) return failJson('E_MEMORY', {});
      if (/interrupted/iu.test(message)) return failJson('E_TIMEOUT', {});
    }
    const detail = { message: name === '' ? message : name + ': ' + message };
    const line = lineFromStack(errorField(error, 'stack'));
    if (line !== undefined) detail.line = line;
    return failJson('E_RUNTIME', detail);
  }

  function finish(value) {
    if (state.error !== undefined) return failJson(state.error.code, state.error.detail);
    let result;
    try {
      result = resultText(value, LIMITS.maxResultChars);
    } catch {
      result = '(the return value could not be shown)';
    }
    const out = { ok: true, calls: state.queued, notes: state.notes, stats: stats() };
    if (result !== undefined) out.result = result;
    return stringify(out);
  }

  const api = freeze({
    find: freeze(find),
    pages: freeze(pages),
    photos: freeze(photos),
    set: freeze(set),
    style: freeze(style),
    tool: freeze(tool),
    fmt: freeze({ num: freeze(fmtNum), money: freeze(fmtMoney) }),
    note: freeze(note),
  });

  return { api, fail, finish, restore, normalize };
}
