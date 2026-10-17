/**
 * The `countdown-clock` behaviour pack: the published face of the Countdown
 * block (blocks-marketing `components/Countdown`).
 *
 * Not the core runtime's `countdown` (a single text clock for free code, read
 * from `data-ck-until`): this one drives a block's own markup, which reads in
 * full without it —
 *
 * - `[data-ck-behavior='countdown-clock']` with `data-ck-target` (ISO 8601
 *   with its UTC offset), `data-ck-lang` (`ar` prints Arabic-Indic digits) and
 *   `data-ck-remaining` (the summary's lead-in);
 * - `[data-ck-countdown-clock]` (hidden) holding one
 *   `[data-ck-countdown-unit]` per unit, each with a
 *   `[data-ck-countdown-value]` and a `[data-ck-countdown-label]`;
 * - `[data-ck-countdown-when]`: "Starts Monday 1 March 2027 at 10:00" — the
 *   whole no-script view;
 * - `[data-ck-countdown-summary]` (visually hidden, polite) and
 *   `[data-ck-countdown-ended]` (a status holding the hidden ended message).
 *
 * It reveals the clock and writes the digits every second — every minute, with
 * the seconds unit hidden, when the visitor prefers reduced motion; once on
 * the editing canvas (`interactive: false`). The digits are `aria-hidden`; the
 * summary changes only with its largest unit (days, hours, five minutes), so a
 * screen reader is told once, not every second. At zero it hides the clock and
 * the date line and shows the ended message. A target that does not parse
 * leaves the static view untouched.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads. Idempotent per element; the disposer stops
 * the timer and restores every attribute and text it changed.
 */
export function mountCountdown(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  const cleanups: (() => void)[] = [];
  if (doc === null || win === null) {
    return function noop() {
      // Nothing was mounted, so there is nothing to undo.
    };
  }
  const view: Window = win;
  const interactive = options?.interactive !== false;
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = '__ckCountdownClock';
  const SELECTOR = "[data-ck-behavior='countdown-clock']";
  const UNITS = ['days', 'hours', 'minutes', 'seconds'];

  function format(lang: string, value: number, pad: boolean): string {
    try {
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-arab' : 'en-US', {
        minimumIntegerDigits: pad ? 2 : 1,
        useGrouping: false,
      }).format(value);
    } catch {
      return pad && value < 10 ? `0${String(value)}` : String(value);
    }
  }

  function mount(el: HTMLElement): void {
    const flag = el as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const target = Date.parse(el.getAttribute('data-ck-target') ?? '');
    const clock = el.querySelector('[data-ck-countdown-clock]');
    if (!Number.isFinite(target) || clock === null) return;
    flag[KEY] = true;
    const lang = (el.getAttribute('data-ck-lang') ?? '').toLowerCase().startsWith('ar')
      ? 'ar'
      : 'en';
    const lead = el.getAttribute('data-ck-remaining') ?? '';
    const when = el.querySelector('[data-ck-countdown-when]');
    const summary = el.querySelector('[data-ck-countdown-summary]');
    const endedBox = el.querySelector('[data-ck-countdown-ended]');
    const message = endedBox === null ? null : endedBox.firstElementChild;

    const hiddenSaved: { node: Element; had: boolean }[] = [];
    function setHidden(node: Element | null, hidden: boolean): void {
      if (node === null) return;
      if (!hiddenSaved.some((entry) => entry.node === node)) {
        hiddenSaved.push({ node, had: node.hasAttribute('hidden') });
      }
      if (hidden) node.setAttribute('hidden', '');
      else node.removeAttribute('hidden');
    }
    const textSaved: { node: Element; text: string | null }[] = [];
    function setText(node: Element | null, text: string): void {
      if (node === null || node.textContent === text) return;
      if (!textSaved.some((entry) => entry.node === node)) {
        textSaved.push({ node, text: node.textContent });
      }
      node.textContent = text;
    }

    const values: Record<string, Element | null> = {};
    const labels: Record<string, string> = {};
    for (const unit of UNITS) {
      values[unit] = el.querySelector(`[data-ck-countdown-value='${unit}']`);
      labels[unit] =
        el.querySelector(`[data-ck-countdown-label='${unit}']`)?.textContent.trim() ?? '';
    }
    if (reduced) setHidden(el.querySelector("[data-ck-countdown-unit='seconds']"), true);

    let timer: number | undefined;
    function stop(): void {
      if (timer !== undefined) view.clearInterval(timer);
      timer = undefined;
    }

    function render(): void {
      const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (left === 0) {
        stop();
        setHidden(clock, true);
        setHidden(when, true);
        setText(summary, '');
        setHidden(message, false);
        return;
      }
      const parts: Record<string, number> = {
        days: Math.floor(left / 86400),
        hours: Math.floor((left % 86400) / 3600),
        minutes: Math.floor((left % 3600) / 60),
        seconds: left % 60,
      };
      for (const unit of UNITS)
        setText(values[unit] ?? null, format(lang, parts[unit] ?? 0, unit !== 'days'));
      setHidden(clock, false);
      /* The largest unit only, minutes in fives: the polite summary changes rarely. */
      let amount = parts['days'] ?? 0;
      let unit = 'days';
      if (amount === 0) {
        amount = parts['hours'] ?? 0;
        unit = 'hours';
      }
      if (amount === 0) {
        amount = Math.max(
          5,
          Math.ceil(((parts['minutes'] ?? 0) + ((parts['seconds'] ?? 0) > 0 ? 1 : 0)) / 5) * 5,
        );
        unit = 'minutes';
      }
      setText(
        summary,
        `${lead === '' ? '' : `${lead}: `}${format(lang, amount, false)} ${labels[unit] ?? ''}`.trim(),
      );
    }

    try {
      render();
    } catch {
      // A failure leaves the static date line, which already says when.
    }
    if (interactive && timer === undefined && Math.floor((target - Date.now()) / 1000) > 0) {
      timer = view.setInterval(
        function tick() {
          try {
            render();
          } catch {
            stop();
          }
        },
        reduced ? 60000 : 1000,
      );
    }
    cleanups.push(function unmount() {
      stop();
      for (let at = textSaved.length - 1; at >= 0; at -= 1) {
        const entry = textSaved[at];
        if (entry !== undefined) entry.node.textContent = entry.text;
      }
      for (const entry of hiddenSaved) {
        if (entry.had) entry.node.setAttribute('hidden', '');
        else entry.node.removeAttribute('hidden');
      }
      flag[KEY] = false;
    });
  }

  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR))
    mount(root as HTMLElement);
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) mount(el as HTMLElement);

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      try {
        cleanups[at]?.();
      } catch {
        // One failing cleanup must not strand the others.
      }
    }
    cleanups.length = 0;
  };
}
