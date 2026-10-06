/**
 * The `mailto-form` behaviour pack (media-motion DESIGN §E), the e-mail
 * sibling of the core runtime's `whatsapp-form`: on a `form` carrying
 * `data-ck-email`, a submit opens the visitor's mail app with
 * `mailto:<email>?subject=…&body=…`.
 *
 * - The subject is the first filled field's value, else the page title.
 * - The body is one `label: value` line per filled field, the label read from
 *   the field's `aria-label`, then its `label[for]` (or wrapping label), then
 *   its placeholder, then its name — the same order `whatsappForm` reads.
 * - Both are `encodeURIComponent`-encoded; nothing a visitor types reaches the
 *   address unencoded. An address that is not a plain e-mail mounts nothing.
 *
 * It sends on the form's `submit`; and since the renderer writes a tree's
 * buttons as `type="button"` outside a sending form, a click on the form's
 * submit button — its `type="submit"` button, else its last button — sends
 * too, after the browser's own validation (`reportValidity`).
 *
 * Interactive only: on the editing canvas (`interactive: false`) it mounts
 * nothing, so a click there selects. `options.window` injects the window
 * whose `location.href` is set (a test's stand-in); it defaults to the
 * form's own.
 *
 * Self-contained for `Function.prototype.toString` serialisation: no imports,
 * no module-scope reads. Idempotent per form; the disposer removes every
 * listener.
 */
export function mountMailtoForm(
  root: ParentNode,
  options?: {
    readonly interactive?: boolean;
    readonly window?: { readonly location: { href: string } };
  },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const cleanups: (() => void)[] = [];
  const target = options?.window ?? (doc === null ? null : doc.defaultView);
  if (doc === null || target === null || options?.interactive === false) {
    return function noop() {
      // Nothing was mounted.
    };
  }
  const page: Document = doc;
  const view = target;
  const MARK = 'data-ck-mounted';
  const KEY = '__ckMailtoForm';
  const SELECTOR = "form[data-ck-behavior='mailto-form'][data-ck-email]";

  function listen(on: EventTarget, type: string, handler: (event: Event) => void): void {
    on.addEventListener(type, handler);
    cleanups.push(function unlisten() {
      on.removeEventListener(type, handler);
    });
  }

  function mount(form: HTMLFormElement): void {
    const flag = form as unknown as Record<string, unknown>;
    if (flag[KEY] === true) return;
    const email = (form.getAttribute('data-ck-email') ?? '').trim();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(email)) return;
    flag[KEY] = true;
    function send(event: Event): void {
      event.preventDefault();
      const lines: string[] = [];
      let subject = '';
      for (const field of Array.from(form.querySelectorAll('input, textarea, select'))) {
        const input = field as HTMLInputElement;
        const type = (input.type || '').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset', 'password', 'file'].includes(type)) continue;
        if ((type === 'checkbox' || type === 'radio') && !input.checked) continue;
        const value = (input.value || '').trim();
        if (value === '') continue;
        if (subject === '') subject = value;
        const labelled = input.labels?.[0];
        /* A wrapping label holds the field itself: read its text without the controls. */
        const copy = labelled === undefined ? null : (labelled.cloneNode(true) as Element);
        if (copy !== null) for (const control of Array.from(copy.querySelectorAll('input, textarea, select'))) control.remove();
        const label = input.getAttribute('aria-label') ?? (copy !== null ? copy.textContent.trim() : '');
        const name = label !== '' ? label : (input.getAttribute('placeholder') ?? input.name);
        lines.push(name !== '' ? `${name}: ${value}` : value);
      }
      if (subject === '') subject = page.title.trim();
      const query: string[] = [];
      if (subject !== '') query.push(`subject=${encodeURIComponent(subject)}`);
      if (lines.length > 0) query.push(`body=${encodeURIComponent(lines.join('\r\n'))}`);
      view.location.href = `mailto:${email}${query.length > 0 ? `?${query.join('&')}` : ''}`;
    }
    listen(form, 'submit', send);
    const buttons = Array.from(form.querySelectorAll('button'));
    const declared = buttons.some((button) => button.type === 'submit');
    const last = buttons[buttons.length - 1];
    if (!declared && last !== undefined) {
      listen(last, 'click', function clicked(event) {
        if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
        send(event);
      });
    }
    const hadMark = form.getAttribute(MARK);
    if (hadMark === null) form.setAttribute(MARK, '');
    cleanups.push(function unmount() {
      if (hadMark === null && form.getAttribute(MARK) === '') form.removeAttribute(MARK);
      flag[KEY] = false;
    });
  }

  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) mount(root as HTMLFormElement);
  for (const form of Array.from(root.querySelectorAll(SELECTOR))) mount(form as HTMLFormElement);

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
