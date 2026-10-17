/**
 * The `table-tools` behaviour pack: the published face of the Table block's
 * sort, search and pages (blocks-marketing `components/Table`).
 *
 * The block's static markup is the whole table in document order, so a page
 * without script reads every row. It carries —
 *
 * - `[data-ck-behavior='table-tools']`, with `data-ck-page-size` when paged;
 * - `th[data-ck-table-sort]` on each sortable column header, naming how the
 *   column sorts (`number`, `date` or `text`), and a
 *   `template[data-ck-table-button]` holding the sort button to clone (its
 *   arrows are styled by the sorted header's `data-sort-up` / `data-sort-down`,
 *   set here beside `aria-sort`);
 * - on each cell of a `number` or `date` column, `data-ck-key`: the value the
 *   block read from the cell (Arabic-Indic digits, "$1,240", "١٤/٠٣/٢٠٢٦") with
 *   the same function its live render sorts by — so the page and the editor
 *   can never disagree, and this script carries no parsing;
 * - a hidden `[data-ck-table-search]` holding the field
 *   `[data-ck-table-query]` and the polite count `[data-ck-table-count]`
 *   (its value is the template: `{shown} of {total} rows`);
 * - a hidden `[data-ck-table-empty]` message;
 * - a hidden `[data-ck-table-pager]` with `[data-ck-table-prev]`,
 *   `[data-ck-table-next]` and the polite status `[data-ck-table-page]`
 *   (template `Page {page} of {pages}`).
 *
 * It reveals the tools, wraps each sortable label in the cloned button, and
 * sorts (by key, or text with `Intl.Collator` in the page language; empty
 * cells last either way), filters (every word; Arabic letters, marks and
 * digits folded, so "احمد ٣" finds "أحمد 3") and pages, by moving the existing
 * rows and toggling `hidden` on them. Text is written with `textContent`
 * only; nothing the page holds is parsed as markup. A template written in
 * Arabic prints Arabic-Indic digits.
 *
 * On the editing canvas (`interactive: false`) it draws the first view and
 * listens to nothing. Its listeners live on the table's own section, and an
 * event that finds the section removed from the page unmounts it.
 *
 * Serialised with `Function.prototype.toString` into the published runtime:
 * no imports, no module-scope reads, and no comments inside (the serialiser
 * keeps them, and every byte ships). Idempotent per table; the disposer
 * restores the row order, the headers, every attribute and every text.
 */
export function mountTableTools(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const unmounts: (() => void)[] = [];
  const KEY = '__ckTableTools';
  const BY = { numeric: true, sensitivity: 'base' } as const;

  function fold(text: string): string {
    return text
      .replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, (digit) => String(digit.charCodeAt(0) & 15))
      .normalize('NFKD')
      .replace(/[\u0300-\u036f\u0640\u064b-\u065f\u0670]/gu, '')
      .replace(/\u0629/gu, '\u0647')
      .replace(/\u0649/gu, '\u064a')
      .toLowerCase();
  }
  function fill(el: HTMLElement | null, name: string, values: Record<string, number>): void {
    if (el === null) return;
    const template = el.getAttribute(name) ?? '';
    const arabic = /[\u0600-\u06ff]/u.test(template);
    el.textContent = template.replace(/\{(\w+)\}/gu, (all: string, key: string) => {
      const value = values[key];
      if (value === undefined) return all;
      return arabic ? value.toLocaleString('ar-u-nu-arab') : String(value);
    });
  }

  function mount(host: HTMLElement): void {
    const flag = host as unknown as Record<string, unknown>;
    const tbody = host.querySelector('tbody');
    if (flag[KEY] === true || tbody === null) return;
    flag[KEY] = true;
    const body: HTMLTableSectionElement = tbody;
    const rows = Array.from(body.rows);
    const texts = rows.map((row) => Array.from(row.cells).map((cell) => cell.textContent.trim()));
    const folded = texts.map((cells) => fold(cells.join(' ')));
    const size = Number(host.getAttribute('data-ck-page-size')) || rows.length || 1;
    const find = (name: string): HTMLElement | null =>
      host.querySelector(`[data-ck-table-${name}]`);
    const input = find('query') as HTMLInputElement | null;
    const boxes = [find('search'), find('pager')];
    const empty = find('empty');
    const prev = find('prev');
    const next = find('next');
    const count = find('count');
    const status = find('page');
    const said = [count?.textContent, status?.textContent];
    const headers = Array.from(
      host.querySelectorAll<HTMLTableCellElement>('th[data-ck-table-sort]'),
    );
    const lang = host.closest('[lang]')?.getAttribute('lang') ?? '';
    let collator = new Intl.Collator([], BY);
    try {
      collator = new Intl.Collator(lang === '' ? [] : lang, BY);
    } catch {
      // A language tag the browser cannot read keeps its own collation.
    }

    const mark = (header: Element, sort?: string): void => {
      header.toggleAttribute('data-sort-up', sort === 'ascending');
      header.toggleAttribute('data-sort-down', sort === 'descending');
      if (sort === undefined) header.removeAttribute('aria-sort');
      else header.setAttribute('aria-sort', sort);
    };
    let order = rows.map((_, index) => index);
    let query = input === null ? '' : input.value;
    let at = 0;
    let sorted = -1;
    let descending = false;

    function render(): void {
      const words = fold(query).split(/\s+/u);
      const shown = order.filter((index) =>
        words.every((word) => (folded[index] ?? '').includes(word)),
      );
      const pages = Math.ceil(shown.length / size) || 1;
      at = Math.max(0, Math.min(at, pages - 1));
      const visible = shown.slice(at * size, (at + 1) * size);
      rows.forEach((row, index) => {
        row.hidden = !visible.includes(index);
      });
      if (empty !== null) empty.hidden = shown.length > 0;
      fill(count, 'data-ck-table-count', { shown: shown.length, total: rows.length });
      fill(status, 'data-ck-table-page', { page: at + 1, pages });
      prev?.setAttribute('aria-disabled', String(at === 0));
      next?.setAttribute('aria-disabled', String(at === pages - 1));
    }

    function sortBy(th: HTMLTableCellElement): void {
      const column = th.cellIndex;
      const byText = th.getAttribute('data-ck-table-sort') === 'text';
      descending = sorted === column && !descending;
      sorted = column;
      for (const header of headers) mark(header);
      mark(th, descending ? 'descending' : 'ascending');
      const keys = rows.map((row, index) =>
        byText
          ? (texts[index]?.[column] ?? '')
          : (row.cells[column]?.getAttribute('data-ck-key') ?? ''),
      );
      order = rows
        .map((_, index) => index)
        .sort((a, b) => {
          const left = keys[a] ?? '';
          const right = keys[b] ?? '';
          const result =
            Number(left === '') - Number(right === '') ||
            (left === ''
              ? 0
              : (byText ? collator.compare(left, right) : Number(left) - Number(right)) *
                (descending ? -1 : 1));
          return result || a - b;
        });
      body.append(...order.flatMap((index) => rows[index] ?? []));
      at = 0;
      render();
    }

    const proto =
      host.querySelector<HTMLTemplateElement>('template[data-ck-table-button]')?.content
        .firstElementChild ?? null;
    const wrapped =
      proto === null
        ? []
        : headers.map((th) => {
            const button = proto.cloneNode(true) as Element;
            const nodes = Array.from(th.childNodes);
            button.prepend(...nodes);
            th.appendChild(button);
            return { th, button, nodes };
          });

    let live = true;
    function unmount(): void {
      if (!live) return;
      live = false;
      host.removeEventListener('click', handle);
      host.removeEventListener('input', handle);
      for (const row of rows) {
        row.hidden = false;
        if (sorted >= 0) body.appendChild(row);
      }
      for (const item of wrapped) {
        for (const node of item.nodes) item.th.insertBefore(node, item.button);
        item.button.remove();
        mark(item.th);
      }
      for (const box of [...boxes, empty]) if (box !== null) box.hidden = true;
      [count, status].forEach((el, index) => {
        if (el !== null) el.textContent = said[index] ?? '';
      });
      prev?.removeAttribute('aria-disabled');
      next?.removeAttribute('aria-disabled');
      flag[KEY] = false;
    }
    function handle(event: Event): void {
      if (!host.isConnected) {
        unmount();
        return;
      }
      if (event.type === 'input') {
        query = input === null ? '' : input.value;
        at = 0;
        render();
        return;
      }
      const button = (event.target as Element).closest('button');
      const th = headers.find((header) => header === button?.parentElement);
      if (th !== undefined) sortBy(th);
      if (button !== null && (button === prev || button === next)) {
        at += button === prev ? -1 : 1;
        render();
      }
    }

    for (const box of boxes) if (box !== null) box.hidden = false;
    render();
    if (options?.interactive !== false) {
      host.addEventListener('click', handle);
      host.addEventListener('input', handle);
    }
    unmounts.push(unmount);
  }

  for (const el of Array.from(root.querySelectorAll("[data-ck-behavior='table-tools']")))
    mount(el as HTMLElement);

  return function dispose() {
    for (const unmount of unmounts.splice(0).reverse()) {
      try {
        unmount();
      } catch {
        // One failing table must not strand the others.
      }
    }
  };
}
