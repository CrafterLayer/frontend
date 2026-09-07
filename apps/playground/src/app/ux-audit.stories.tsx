import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import './App.css';
import { BuilderTheme, DesignSystemPanel, SitePages, defaultDesignSystem } from '@craftkit/builder';

import { AssistantPanel } from '../features/preview/components/AssistantPanel';
import { auditKernel, auditSiteKernel } from './ux-audit-kernel';
import { auditRegion } from './ux-audit';

function Surface() {
  return (
    <BuilderTheme className="pg-app" theme="dark">
      <section className="pg-site-builder" aria-label="Build a site">
        <h2 className="pg-site-builder__title">Build a site</h2>
        <form className="pg-brief">
          <label className="pg-brief__label" htmlFor="brief">
            Describe the site you want
          </label>
          <textarea id="brief" className="pg-brief__field" rows={3} defaultValue="" />
          <p className="pg-brief__hint">One sentence is enough.</p>
          <p className="pg-brief__status" role="status" />
          <p className="pg-brief__message">Write a sentence about the site first.</p>
          <div className="pg-brief__actions">
            <button type="submit" className="pg-brief__submit">
              Build the site
            </button>
          </div>
        </form>
        <p className="pg-site-builder__outcome" data-ok="false">
          The site changed while this was building.
        </p>
      </section>
    </BuilderTheme>
  );
}

const meta = {
  title: 'Playground/UXAudit',
  component: Surface,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SiteBuilder: Story = {
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) throw new Error('a real window is required');
    const region = within(canvasElement).getByRole('region', { name: 'Build a site' });

    const findings = auditRegion(region, view);
    /* Non-vacuity: an empty surface has no findings, forever. */
    await expect(region.querySelectorAll('button, input, textarea').length).toBeGreaterThan(1);
    await expect(
      findings.map((finding) => `${finding.rule}: ${finding.detail}`),
      'UX audit findings',
    ).toEqual([]);
  },
};

/**
 * The ASSISTANT panel, which is the surface a person actually spends their day
 * in — and the one they said had gone wrong.
 *
 * Rendered whole, from the real component, with a scripted provider: a panel
 * audited from a hand-written approximation of itself proves nothing about the
 * panel.
 */
export const Assistant: Story = {
  render: () => (
    <BuilderTheme className="pg-app" theme="dark">
      <div style={{ inlineSize: '24rem' }}>
        <AssistantPanel kernel={auditKernel()} locale="en" persistKey={undefined} />
      </div>
    </BuilderTheme>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) throw new Error('a real window is required');
    const panel = within(canvasElement).getByRole('region', { name: 'Assistant' });

    const findings = auditRegion(panel, view);
    await expect(panel.querySelectorAll('button, input, textarea, select').length).toBeGreaterThan(
      4,
    );
    await expect(
      findings.map((finding) => `${finding.rule}: ${finding.detail}`),
      'UX audit findings',
    ).toEqual([]);
  },
};

/**
 * The two surfaces D9 and D11 added, audited by the same rules.
 *
 * A gate that only ever ran over the screen it was written for is a gate that
 * ages out of usefulness the moment someone builds the next screen.
 */
export const DesignSystem: Story = {
  render: () => (
    <BuilderTheme className="pg-app" theme="dark">
      <div style={{ inlineSize: '24rem' }}>
        <DesignSystemPanel
          system={defaultDesignSystem()}
          onChangeToken={() => undefined}
          onRegenerate={() => undefined}
          issues={['"accent" on "surface" measures 1.23:1, below the 4.5:1 this text needs.']}
        />
      </div>
    </BuilderTheme>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) throw new Error('a real window is required');
    const region = within(canvasElement).getByRole('region', { name: 'Design system' });

    const findings = auditRegion(region, view);
    /* Sixty-odd swatches plus a field: an empty pass is impossible. */
    await expect(region.querySelectorAll('button, input').length).toBeGreaterThan(20);
    await expect(
      findings.map((finding) => `${finding.rule}: ${finding.detail}`),
      'UX audit findings',
    ).toEqual([]);
  },
};

export const Pages: Story = {
  render: () => (
    <BuilderTheme className="pg-app" theme="dark">
      <div style={{ inlineSize: '20rem' }}>
        <SitePages siteKernel={auditSiteKernel()} />
      </div>
    </BuilderTheme>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) throw new Error('a real window is required');
    const region = within(canvasElement).getByRole('navigation', { name: 'Pages' });

    const findings = auditRegion(region, view);
    await expect(region.querySelectorAll('[role="option"], button, input').length).toBeGreaterThan(
      3,
    );
    await expect(
      findings.map((finding) => `${finding.rule}: ${finding.detail}`),
      'UX audit findings',
    ).toEqual([]);
  },
};
