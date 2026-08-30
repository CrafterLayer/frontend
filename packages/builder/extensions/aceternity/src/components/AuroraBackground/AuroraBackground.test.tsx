import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AuroraBackground } from './AuroraBackground';
import { auroraBackgroundSchema } from './schema';

const node: Node = { id: 'aurora', type: 'auroraBackground', props: {} };

function renderAurora(props: Record<string, unknown>, children: React.ReactNode = <p>Inside</p>) {
  return render(
    <AuroraBackground
      node={node}
      props={auroraBackgroundSchema.props.parse(props)}
      slots={{ default: children }}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('AuroraBackground', () => {
  it('renders whatever it is framing', () => {
    renderAurora({});

    expect(screen.getByText('Inside')).toBeInTheDocument();
  });

  /*
    The adaptation that justifies vendoring this at all. Upstream hard-codes
    Tailwind's palette into the gradient, so every generated site would have
    carried the same blue effect at the top of the page regardless of its brand.
    The effect is driven by custom properties the stylesheet reads from --t-*.
  */
  it('drives its intensity from a custom property, not a class per level', () => {
    const { container } = renderAurora({ intensity: 'bold' });
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--acy-aurora-opacity')).toBe('0.7');
  });

  it('gives each intensity a different value', () => {
    const values = (['subtle', 'normal', 'bold'] as const).map((intensity) => {
      const { container } = renderAurora({ intensity });
      return (container.firstElementChild as HTMLElement).style.getPropertyValue(
        '--acy-aurora-opacity',
      );
    });

    expect(new Set(values).size).toBe(3);
  });

  /*
    Stillness is a real choice, not the absence of one: a page with three moving
    backgrounds is a page nobody can read.
  */
  it('pauses the drift when the document asks for stillness', () => {
    const { container } = renderAurora({ animate: false });
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--acy-aurora-play')).toBe('paused');
  });

  it('runs the drift by default', () => {
    const { container } = renderAurora({});

    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue('--acy-aurora-play'),
    ).toBe('running');
  });

  /*
    `svh`, not `vh`. On a phone `100vh` is the viewport WITHOUT browser chrome,
    so a full-height hero sits partly under the address bar until the user
    scrolls — the most common mobile layout bug of the last decade.
  */
  it('measures full height in svh so a phone does not hide the top of it', () => {
    const { container } = renderAurora({ minHeight: 'screen' });

    expect(container.firstElementChild?.className).toContain('svh');
    expect(container.firstElementChild?.className).not.toMatch(/min-h-\[100vh\]/);
  });

  it('claims no height when none was asked for', () => {
    const { container } = renderAurora({ minHeight: 'none' });

    expect(container.firstElementChild?.className).not.toMatch(/min-h-/);
  });

  it('applies the document utilities last, so a caller wins a conflict', () => {
    const { container } = renderAurora({ className: 'rounded-base overflow-hidden' });
    const classes = container.firstElementChild?.className ?? '';

    expect(classes).toContain('acy-aurora');
    expect(classes.indexOf('rounded-base')).toBeGreaterThan(classes.indexOf('acy-aurora'));
  });

  it('carries motion as attributes rather than an inline timing', () => {
    const { container } = renderAurora({ motion: { reveal: 'fade' } });
    const root = container.firstElementChild;

    expect(root?.getAttribute('data-reveal')).toBe('fade');
    expect(root?.outerHTML ?? '').not.toMatch(/\d+ms/);
  });

  describe('schema', () => {
    /*
      The same layer-0 rule every other block uses. This is what "the AI can
      customise it" means concretely: any layout or spacing utility is allowed,
      and the two families the design system cannot reach are refused at the
      door rather than discovered on the page.
    */
    it('accepts token-bound utilities in className', () => {
      const result = auroraBackgroundSchema.props.safeParse({
        className: 'rounded-base p-8 sm:p-12 bg-surface',
      });

      expect(result.success).toBe(true);
    });

    it('refuses an arbitrary value', () => {
      expect(auroraBackgroundSchema.props.safeParse({ className: 'p-[17px]' }).success).toBe(false);
    });

    it('refuses Tailwind own palette, which the design system cannot reach', () => {
      expect(auroraBackgroundSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(
        false,
      );
    });

    it('frames a hero, which is what people reach for it to do', () => {
      expect(auroraBackgroundSchema.slots?.['default']?.allow).toContain('hero');
    });

    it('stores no literal colour or length of its own', () => {
      const parsed = auroraBackgroundSchema.props.parse({});

      expect(JSON.stringify(parsed)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(JSON.stringify(parsed)).not.toMatch(/\d+px/);
    });
  });
});
