import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BuilderDocument } from '@craftkit/builder-schema';

import { TemplateCard } from './TemplateCard';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { TEMPLATE_CARD_LABELS_AR } from './TemplateCard.labels';
import {
  documentLanguage,
  orderTemplateCards,
  pageContentLanguage,
  templateCardSearchText,
  type TemplateCardInfo,
} from './template-order';

afterEach(cleanup);

const CARD: TemplateCardInfo = {
  id: 'restaurant',
  templateKey: 'restaurant',
  lang: 'en',
  category: 'restaurant',
  name: { en: 'Restaurant', ar: 'مطعم' },
  description: { en: 'A menu, a gallery and a table booking.', ar: 'قائمة طعام ومعرض صور وحجز طاولة.' },
  sections: 10,
  thumbnail: { src: 'https://images.example/table.jpg?w=640', alt: 'A table of shared dishes' },
};

const AR_CARD: TemplateCardInfo = {
  ...CARD,
  id: 'restaurant-ar',
  lang: 'ar',
  thumbnail: { src: CARD.thumbnail.src, alt: 'طاولة عليها أطباق مشتركة' },
};

function page(props: Record<string, string>, dir: 'ltr' | 'rtl'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props } },
  };
}

describe('TemplateCard', () => {
  beforeAll(installBrowserStandIns);
  it('suppresses click insertion after a drag and blocks the native image drag', () => {
    const onInsert = vi.fn();
    const onBeginDrag = vi.fn(() => ({ didActivate: () => true }));
    render(<TemplateCard card={CARD} onInsert={onInsert} onBeginDrag={onBeginDrag} />);
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { button: 0, clientX: 20, clientY: 30 });
    expect(onBeginDrag).toHaveBeenCalledWith(20, 30);
    fireEvent.click(button);
    expect(onInsert).not.toHaveBeenCalled();
    expect(fireEvent.dragStart(screen.getByRole('img'))).toBe(false);
  });
  it('renders the photo, the name and description in the editor language, the badge and the count', () => {
    render(<TemplateCard card={CARD} onInsert={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Insert template Restaurant' });
    expect(button).toHaveAccessibleDescription(/A menu, a gallery and a table booking\..*English page.*10 sections/u);
    const photo = screen.getByRole('img', { name: 'A table of shared dishes' });
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(photo).toHaveAttribute('src', CARD.thumbnail.src);
    expect(photo).toHaveAttribute('lang', 'en');
    expect(button.querySelector('.bldr-template-card__strip')).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveTextContent('EN');
  });

  it('an Arabic editor reads Arabic copy for an English page, with an EN badge', () => {
    render(<TemplateCard card={CARD} labels={TEMPLATE_CARD_LABELS_AR} onInsert={() => undefined} />);
    const button = screen.getByRole('button', { name: 'إدراج القالب مطعم' });
    expect(button).toHaveTextContent('قائمة طعام ومعرض صور وحجز طاولة.');
    expect(button).toHaveTextContent('10 أقسام');
    expect(button).toHaveAccessibleDescription(/صفحة إنجليزية/u);
    expect(button.querySelector('.bldr-template-card__badge')).toHaveTextContent('EN');
  });

  it('an Arabic page carries the ع badge in its own language', () => {
    render(<TemplateCard card={AR_CARD} onInsert={() => undefined} />);
    const badge = screen.getByRole('button').querySelector('.bldr-template-card__badge');
    expect(badge).toHaveAttribute('data-lang', 'ar');
    expect(badge?.querySelector('[lang="ar"]')).toHaveTextContent('ع');
    expect(screen.getByRole('button')).toHaveAccessibleDescription(/Arabic page/u);
  });

  it('inserts on click, Enter and Space — it is one native button', async () => {
    const onInsert = vi.fn();
    const user = userEvent.setup();
    render(<TemplateCard card={CARD} onInsert={onInsert} />);
    await user.click(screen.getByRole('button'));
    await user.tab();
    await user.tab({ shift: true });
    expect(screen.getByRole('button')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onInsert).toHaveBeenCalledTimes(3);
    expect(onInsert).toHaveBeenCalledWith(CARD);
  });

  it('a photo that fails to load leaves the skeleton ground, not a broken image', () => {
    render(<TemplateCard card={CARD} onInsert={() => undefined} />);
    const photo = screen.getByRole('img');
    expect(photo.parentElement).toHaveAttribute('data-photo', 'loading');
    fireEvent.error(photo);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button').querySelector('.bldr-template-card__thumb')).toHaveAttribute(
      'data-photo',
      'failed',
    );
  });
});

describe('template ordering and page language', () => {
  it('the page language is the root lang tag, else the direction (the static export rule)', () => {
    expect(documentLanguage(page({ lang: 'ar-JO' }, 'ltr'))).toBe('ar-JO');
    expect(documentLanguage(page({ lang: '' }, 'rtl'))).toBe('ar');
    expect(documentLanguage(page({}, 'ltr'))).toBe('en');
    expect(documentLanguage(page({ lang: 'not a tag!' }, 'rtl'))).toBe('ar');
    expect(pageContentLanguage(page({ lang: 'ar-JO' }, 'ltr'))).toBe('ar');
    expect(pageContentLanguage(page({ lang: 'fr' }, 'rtl'))).toBe('ar');
    expect(pageContentLanguage(page({ lang: 'en-GB' }, 'rtl'))).toBe('en');
  });

  it('cards in the page language come first; the rest are kept, never hidden', () => {
    const entries = [CARD, AR_CARD, { ...CARD, id: 'clinic' }].map((card) => ({ card }));
    const rtl = orderTemplateCards(entries, 'ar');
    expect(rtl.matching.map((entry) => entry.card.id)).toEqual(['restaurant-ar']);
    expect(rtl.other.map((entry) => entry.card.id)).toEqual(['restaurant', 'clinic']);
    const ltr = orderTemplateCards(entries, 'en');
    expect(ltr.matching.map((entry) => entry.card.id)).toEqual(['restaurant', 'clinic']);
    expect(ltr.other.map((entry) => entry.card.id)).toEqual(['restaurant-ar']);
  });

  it('search text holds both languages', () => {
    const text = templateCardSearchText(CARD);
    expect(text).toContain('restaurant');
    expect(text).toContain('مطعم');
    expect(text).toContain('حجز طاولة');
  });
});
