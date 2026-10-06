import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { CustomCodeNode, CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountToggleGroup } from '../toggle-group';
import { WIDGETS_PACK_CSS } from '../widgets-css';

interface Plan {
  readonly name: string;
  readonly monthly: string;
  readonly yearly: string;
}

function price(option: 'a' | 'b', text: string): CustomCodeNode {
  return {
    kind: 'element',
    tag: 'p',
    text,
    attributes: option === 'b' ? { 'data-ck-option': 'b', hidden: '' } : { 'data-ck-option': 'a' },
  };
}

function pricingTree(switchText: string, plans: readonly Plan[]): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { 'data-ck-behavior': 'toggle-group' },
        children: [
          { kind: 'element', tag: 'button', text: switchText },
          {
            kind: 'element',
            tag: 'div',
            children: plans.map(
              (plan): CustomCodeNode => ({
                kind: 'element',
                tag: 'article',
                children: [
                  { kind: 'element', tag: 'h3', text: plan.name },
                  price('a', plan.monthly),
                  price('b', plan.yearly),
                ],
              }),
            ),
          },
        ],
      },
    ],
  };
}

interface StageProps {
  readonly tree: CustomCodeRoot;
  readonly locale: 'ar' | 'en';
  readonly isCanvas?: boolean;
}

/* A layout effect runs before CustomCode's passive one, so the pack's guard keeps one mount. */
function PricingStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    return mountToggleGroup(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  return (
    <div ref={ref} lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxInlineSize: 560 }}>
      <style>{WIDGETS_PACK_CSS}</style>
      <CustomCode hostId="pricing-story" tree={tree} isCanvas={isCanvas} />
    </div>
  );
}

const ENGLISH = pricingTree('Billed yearly', [
  { name: 'Starter', monthly: '$9 / month', yearly: '$90 / year' },
  { name: 'Studio', monthly: '$29 / month', yearly: '$290 / year' },
]);

const ARABIC = pricingTree('الدفع سنويًا', [
  { name: 'البداية', monthly: '٩ دنانير / شهريًا', yearly: '٩٠ دينارًا / سنويًا' },
  { name: 'الاستوديو', monthly: '٢٩ دينارًا / شهريًا', yearly: '٢٩٠ دينارًا / سنويًا' },
]);

const meta = {
  title: 'Builder/Renderer/Behaviors/PricingToggle',
  component: PricingStage,
  parameters: { layout: 'padded' },
  args: { tree: ENGLISH, locale: 'en' },
} satisfies Meta<typeof PricingStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Monthly prices first; the switch shows the yearly ones and back. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Billed yearly' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(canvas.getByText('$9 / month')).toBeVisible();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('$90 / year')).toBeVisible();
    await expect(canvas.getByText('$9 / month')).not.toBeVisible();
  },
};

/** On an Arabic page the knob starts at the right — the inline start — and travels left. */
export const Arabic: Story = {
  args: { tree: ARABIC, locale: 'ar' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'الدفع سنويًا' });
    const knob = () => Number.parseFloat(getComputedStyle(toggle, '::after').right);
    const resting = knob();
    await userEvent.click(toggle);
    await expect(canvas.getByText('٩٠ دينارًا / سنويًا')).toBeVisible();
    // The knob's distance from the right edge grew: it moved toward the inline end.
    await waitFor(() => expect(knob()).toBeGreaterThan(resting));
  },
};

/** On the editing canvas the monthly prices show and the switch is inert. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch');
    await expect(toggle.style.pointerEvents).toBe('none');
    await expect(canvas.getByText('$9 / month')).toBeVisible();
  },
};
