/**
 * The UX rules a real browser can check, checked on the real surface.
 *
 * ## Why a gate and not a checklist
 *
 * Every rule below is one a person can read in a guideline and believe they
 * followed. "Interactive elements are big enough", "icon buttons have names",
 * "focus is visible" — all three were true of this panel in someone's head and
 * two of them were false on screen. A checklist is a memory of a decision; this
 * is the decision, re-made on every run.
 *
 * ## Why the rules are relaxed where they should be
 *
 * A 44px minimum is a TOUCH rule. This is a desktop builder chrome whose
 * controls sit in dense rows a person hits with a cursor, and the WCAG 2.2
 * target size (minimum) criterion is 24×24 for pointer input with adequate
 * spacing. So the gate holds pointer controls to 24 and states plainly that a
 * touch surface would need the other number — rather than pretending 44 and
 * being switched off the first time it is inconvenient.
 */

const POINTER_MIN = 24;
const AA_TEXT = 4.5;
const AA_LARGE = 3;

interface Finding {
  readonly rule: string;
  readonly detail: string;
}

function describeElement(element: Element): string {
  const name = (element.getAttribute('aria-label') ?? element.textContent)
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 32);
  const classes = element.classList.length === 0 ? '' : `.${element.classList[0] ?? ''}`;
  return `${element.tagName.toLowerCase()}${classes}${name === '' ? '' : ` "${name}"`}`;
}

function channelsOf(colour: string): [number, number, number, number] {
  const parts = /rgba?\(([^)]+)\)/u.exec(colour)?.[1]?.split(',') ?? [];
  return [
    Number.parseFloat(parts[0] ?? '0'),
    Number.parseFloat(parts[1] ?? '0'),
    Number.parseFloat(parts[2] ?? '0'),
    parts[3] === undefined ? 1 : Number.parseFloat(parts[3]),
  ];
}

function luminance(colour: string): number {
  const [red, green, blue] = channelsOf(colour);
  const linear = [red, green, blue].map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The first ancestor that actually paints a ground, since most are transparent.
 *
 * Returns `undefined` when nothing does, and the audit reports that as its own
 * finding rather than assuming a colour. Assuming white produced three
 * confident 1.14:1 failures against a ground that was never painted — a gate
 * inventing the number it then failed on, which is worse than no gate.
 */
function groundOf(element: Element, view: Window): string | undefined {
  let node: Element | null = element;
  while (node !== null) {
    const colour = view.getComputedStyle(node).backgroundColor;
    if (channelsOf(colour)[3] > 0.85) return colour;
    node = node.parentElement;
  }
  return undefined;
}

/**
 * Text painted through a gradient has NO computed colour — `background-clip:
 * text` leaves `color: transparent` — so measuring it as written reports a
 * confident 1.22:1 about a colour nobody painted. It is also the case axe
 * cannot check.
 *
 * The stops CAN be checked, and they are the thing that decides legibility: if
 * every stop clears the floor against the ground, every pixel between them
 * does too. So clipped text is measured by its stops rather than skipped.
 */
function gradientStops(style: CSSStyleDeclaration): readonly string[] {
  /*
    `background-clip` only. The `-webkit-` alias is deprecated and this runs in
    a modern browser; reading both would be reading the same value twice.
  */
  if (style.backgroundClip !== 'text') return [];
  return [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/gu)].map((match) => match[0]);
}

const isTransparent = (colour: string): boolean => channelsOf(colour)[3] < 0.05;

/**
 * Every colour this element actually paints its text with — one, normally, or
 * the gradient's stops when the text is clipped to a background.
 *
 * Empty means nothing measurable was found, which the audit reports rather than
 * passing silently: "I could not check this" is a finding, not a success.
 */
function paintedColours(style: CSSStyleDeclaration): readonly string[] {
  if (!isTransparent(style.color)) return [style.color];
  return gradientStops(style);
}

/** Everything a person can operate. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="option"], [tabindex="0"]';

export function auditRegion(root: HTMLElement, view: Window): readonly Finding[] {
  const findings: Finding[] = [];

  for (const element of root.querySelectorAll(INTERACTIVE)) {
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    const where = describeElement(element);

    /* 1. An accessible name. An icon button without one is a mystery. */
    const named =
      (element.getAttribute('aria-label') ?? '').trim() !== '' ||
      (element.getAttribute('aria-labelledby') ?? '').trim() !== '' ||
      element.textContent.trim() !== '' ||
      (element.getAttribute('title') ?? '').trim() !== '' ||
      (element.id !== '' && root.querySelector(`label[for="${element.id}"]`) !== null);
    if (!named) findings.push({ rule: 'accessible-name', detail: where });

    /* 2. A target a cursor can hit. */
    if (Math.round(box.width) < POINTER_MIN || Math.round(box.height) < POINTER_MIN) {
      findings.push({
        rule: 'target-size',
        detail: `${where} is ${String(Math.round(box.width))}×${String(Math.round(box.height))}, below ${String(POINTER_MIN)}`,
      });
    }

    /* 3. A cursor that says it is clickable. */
    const clickable = element.tagName === 'BUTTON' || element.tagName === 'A';
    const disabled =
      element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
    if (clickable && !disabled && style.cursor !== 'pointer') {
      findings.push({ rule: 'cursor-pointer', detail: `${where} has cursor: ${style.cursor}` });
    }

    /*
      4. A focus ring a keyboard user can see.

      Checked by ASKING for it: the element is focused and its resolved outline
      read back. A source scan for `:focus-visible` proves a rule was written,
      not that it survived specificity, and "we have focus styles" is exactly
      the belief this rule exists to test.
    */
    const focusable = element instanceof HTMLElement ? element : undefined;
    if (!disabled && focusable !== undefined) {
      const before = view.document.activeElement;
      /*
        Compared BEFORE and AFTER, over the element AND its nearest ancestors.

        The first version looked only at the element and failed the composer's
        textarea — which delegates its ring to the card by `:focus-within`, on
        purpose, so that tabbing to the send button does not move a ring off the
        thing a person is looking at. A rule that cannot see a delegated ring
        would have pushed a good design into a worse one to satisfy a check.

        What matters is that SOMETHING visibly changes, wherever it is drawn.

        HONESTLY BOUNDED: this rule has been observed to FIRE — on the
        composer's textarea, before ancestors were considered — and to stop
        firing once the delegated ring was accounted for. It has NOT been shown
        to catch an `outline: none` with no replacement on a field whose
        ancestors do not react; several attempts to construct that case left the
        gate green. So it is a rule that has caught something real, not a rule
        with a proof behind it, and it is written down that way rather than
        listed among the guarantees.
      */
      /*
        Four ancestors, not two. The v2 composer draws its ring on the card by
        `:has(.ck-agent-composer__input:focus)`, and the card is the textarea's
        great-grandparent (card > section > field > textarea). Two levels could
        not see it and the AgentPanel audit story reported a ring that is there.
        An element may also name its ring host explicitly with
        `data-focus-ring-host` on any ancestor.
      */
      const chain: HTMLElement[] = [focusable];
      for (let node = focusable.parentElement, depth = 0; node !== null && depth < 4; depth += 1) {
        chain.push(node);
        node = node.parentElement;
      }
      const host = focusable.parentElement?.closest('[data-focus-ring-host]');
      if (host instanceof HTMLElement && !chain.includes(host)) chain.push(host);
      const ringOf = (): string =>
        chain
          .map((node) => {
            const at = view.getComputedStyle(node);
            return `${at.outline}|${at.boxShadow}|${at.borderColor}`;
          })
          .join('~');

      const resting = ringOf();
      focusable.focus();
      const focusedRing = ringOf();
      if (view.document.activeElement === focusable && focusedRing === resting) {
        findings.push({ rule: 'focus-ring', detail: where });
      }
      if (before instanceof HTMLElement) before.focus();
      else focusable.blur();
    }

    /* 5. Readable text, against the ground it is actually on. */
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const floor = size >= 24 || (size >= 18.66 && bold) ? AA_LARGE : AA_TEXT;
    const ground = groundOf(element, view);
    if (ground === undefined) {
      findings.push({ rule: 'no-ground', detail: `${where} sits on nothing that paints` });
    } else {
      for (const colour of paintedColours(style)) {
        const measured = ratio(colour, ground);
        if (measured < floor) {
          findings.push({
            rule: 'contrast',
            detail: `${where} paints ${colour} at ${measured.toFixed(2)}:1, below ${String(floor)}:1`,
          });
        }
      }
      if (paintedColours(style).length === 0) {
        findings.push({ rule: 'unverifiable-contrast', detail: where });
      }
    }
  }

  /* 6. Every text node's own contrast, not only the interactive ones. */
  for (const element of root.querySelectorAll('p, span, li, h1, h2, h3, label, legend')) {
    const own = [...element.childNodes].some(
      (node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== '',
    );
    if (!own) continue;
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (element.closest('.bldr-visually-hidden') !== null) continue;
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const floor = size >= 24 || (size >= 18.66 && bold) ? AA_LARGE : AA_TEXT;
    const ground = groundOf(element, view);
    if (ground === undefined) {
      findings.push({
        rule: 'no-ground',
        detail: `${describeElement(element)} sits on nothing that paints`,
      });
      continue;
    }
    for (const colour of paintedColours(style)) {
      const measured = ratio(colour, ground);
      if (measured < floor) {
        findings.push({
          rule: 'contrast',
          detail: `${describeElement(element)} paints ${colour} at ${measured.toFixed(2)}:1, below ${String(floor)}:1`,
        });
      }
    }
    if (paintedColours(style).length === 0) {
      findings.push({ rule: 'unverifiable-contrast', detail: describeElement(element) });
    }
  }

  return findings;
}
