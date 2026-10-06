/** The element panel's tabs (style-manager DESIGN.md §A.5). */
export const ELEMENT_TABS = ['content', 'design', 'interactions', 'code'] as const;
export type ElementTabId = (typeof ELEMENT_TABS)[number];

/*
  The selected tab is remembered for the session: clicking from one heading to
  the next keeps a person on Design if that is where they work. Session memory,
  not document state and not storage — a reload starts on Design again.
*/
let remembered: ElementTabId = 'design';

export function rememberedElementTab(): ElementTabId {
  return remembered;
}

export function rememberElementTab(tab: ElementTabId): void {
  remembered = tab;
}

export function isElementTab(value: string): value is ElementTabId {
  return (ELEMENT_TABS as readonly string[]).includes(value);
}
