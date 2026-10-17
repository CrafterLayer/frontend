import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ShadcnAlert } from './ShadcnAlert';
import { shadcnAlertSchema } from './schema';

afterEach(cleanup);

const node = { id: 'alert-1', type: 'shadcnAlert', props: {} };

const renderAlert = (overrides: Record<string, unknown> = {}) =>
  render(
    <ShadcnAlert
      node={node}
      props={shadcnAlertSchema.props.parse(overrides)}
      slots={{ default: <p>Read the migration notes.</p> }}
      data={{}}
      isCanvas={false}
    />,
  );

describe('ShadcnAlert', () => {
  it('renders its title and its body content', () => {
    renderAlert({ title: 'Scheduled maintenance' });

    expect(screen.getByText('Scheduled maintenance')).toBeInTheDocument();
    expect(screen.getByText('Read the migration notes.')).toBeInTheDocument();
  });

  /*
    THE assertion this component exists for.

    Upstream distinguishes its two variants by text colour alone, which sends
    severity — the single most important thing about an alert — through the one
    channel a colour-blind reader does not have. The role carries it too.
  */
  it('announces a critical alert and lets an informational one wait its turn', () => {
    expect(renderAlert({ variant: 'critical' }).container.firstElementChild).toHaveAttribute(
      'role',
      'alert',
    );
    cleanup();
    expect(renderAlert({ variant: 'info' }).container.firstElementChild).toHaveAttribute(
      'role',
      'status',
    );
    cleanup();
    expect(renderAlert({ variant: 'attention' }).container.firstElementChild).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('hides the decorative glyph from the accessibility tree', () => {
    const { container } = renderAlert();

    /* The role and the title already carry the meaning; the glyph repeats it. */
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('schema: the body takes BLOCKS, so it can link to the fix', () => {
    expect(shadcnAlertSchema.slots?.['default']?.allow).toContain('cta');
  });

  it('schema: refuses a class the design system cannot reach', () => {
    expect(shadcnAlertSchema.props.safeParse({ className: 'text-red-600' }).success).toBe(false);
    expect(shadcnAlertSchema.props.safeParse({ className: 'md:p-6' }).success).toBe(true);
  });
});
