import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ShineBorder } from './ShineBorder';
import { shineBorderSchema } from './schema';

const node: Node = { id: 'shine', type: 'shineBorder', props: {} };

function renderShine(props: Record<string, unknown>, children: React.ReactNode = <p>Framed</p>) {
  return render(
    <ShineBorder
      node={node}
      props={shineBorderSchema.props.parse(props)}
      slots={{ default: children }}
      data={{}}
      isCanvas={false}
    />,
  );
}

function root(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

describe('ShineBorder', () => {
  it('renders whatever it is framing', () => {
    renderShine({});

    expect(screen.getByText('Framed')).toBeInTheDocument();
  });

  /*
    The adaptation that justifies vendoring rather than copying. Upstream takes
    NUMBERS — borderRadius={8}, borderWidth={1}, duration={14}, color="#000000"
    — and every one is a literal a theme cannot move: a black shine on a
    terracotta brand, an 8px radius on a page whose corners are 12.
  */
  it('expresses weight as a multiple of the border token, never as pixels', () => {
    const { container } = renderShine({ weight: 'medium' });

    expect(root(container).style.getPropertyValue('--mgc-shine-width')).toBe(
      'calc(var(--t-border-width) * 2)',
    );
  });

  it('gives every weight a different value, all token-derived', () => {
    const widths = (['hairline', 'medium', 'heavy'] as const).map((weight) => {
      const { container } = renderShine({ weight });
      return root(container).style.getPropertyValue('--mgc-shine-width');
    });

    expect(new Set(widths).size).toBe(3);
    for (const width of widths) {
      expect(width).toContain('--t-border-width');
    }
  });

  it('names its speeds rather than storing a number of seconds', () => {
    const { container } = renderShine({ speed: 'slow' });

    // The DOCUMENT said "slow"; only the stylesheet layer knows what that costs.
    expect(root(container).style.getPropertyValue('--mgc-shine-duration')).toBe('22s');
    expect(JSON.stringify(shineBorderSchema.props.parse({ speed: 'slow' }))).not.toMatch(/\d+s\b/);
  });

  it('stops the travel when the document asks for stillness', () => {
    const { container } = renderShine({ animate: false });

    expect(root(container).style.getPropertyValue('--mgc-shine-play')).toBe('paused');
  });

  it('travels by default', () => {
    const { container } = renderShine({});

    expect(root(container).style.getPropertyValue('--mgc-shine-play')).toBe('running');
  });

  it('applies the document utilities last, so a caller wins a conflict', () => {
    const { container } = renderShine({ className: 'rounded-base p-8' });
    const classes = root(container).className;

    expect(classes).toContain('mgc-shine');
    expect(classes.indexOf('p-8')).toBeGreaterThan(classes.indexOf('mgc-shine'));
  });

  it('carries motion as attributes rather than an inline timing', () => {
    const { container } = renderShine({ motion: { reveal: 'fade' } });

    expect(root(container).getAttribute('data-reveal')).toBe('fade');
  });

  describe('schema', () => {
    it('accepts token-bound utilities in className', () => {
      expect(
        shineBorderSchema.props.safeParse({ className: 'rounded-base p-6 sm:p-8 bg-surface' })
          .success,
      ).toBe(true);
    });

    it('refuses an arbitrary value and the default palette', () => {
      expect(shineBorderSchema.props.safeParse({ className: 'p-[9px]' }).success).toBe(false);
      expect(shineBorderSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(false);
    });

    /*
      The block's description says never more than one shine per page, and its
      slot list is what makes the intended use — a single highlighted card —
      the easy one to reach for.
    */
    it('frames the things a page actually highlights', () => {
      const allow = shineBorderSchema.slots?.['default']?.allow ?? [];

      expect(allow).toContain('pricingPlan');
      expect(allow).toContain('cta');
    });

    it('stores no literal colour, length, or duration', () => {
      const parsed = shineBorderSchema.props.parse({});

      expect(JSON.stringify(parsed)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(JSON.stringify(parsed)).not.toMatch(/\d+(px|s|ms)\b/);
    });
  });
});
