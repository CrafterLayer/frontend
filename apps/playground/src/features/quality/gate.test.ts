import type { BuilderDocument } from '@craftkit/builder';
import { describe, expect, it, vi } from 'vitest';

import { runQualityGate } from './gate';
import type { QualityWidth } from './measure-layout';

/** A page with one real section: nothing for the DOM-free half to complain about. */
const page = (): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1'] } },
    s1: {
      id: 's1',
      type: 'customCode',
      props: {
        tree: {
          kind: 'root',
          children: [
            { kind: 'element', tag: 'h2', text: 'Hero' },
            { kind: 'element', tag: 'p', text: 'Real copy.' },
          ],
        },
      },
    },
  },
});

/** A rendered page whose one paragraph is `width` wide. */
function rendered(width: number): Document {
  const document = window.document.implementation.createHTMLDocument('gate');
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Body';
  const base = { left: 0, top: 0, right: width, bottom: 20, width, height: 20, x: 0, y: 0 };
  const rect = { ...base, toJSON: () => base } as DOMRect;
  paragraph.getBoundingClientRect = () => rect;
  document.body.append(paragraph);
  return document;
}

describe('runQualityGate', () => {
  it('runs both halves and passes a page with nothing wrong', () => {
    const report = runQualityGate(page(), { render: () => rendered(300) });
    expect(report.issues).toEqual([]);
    expect(report.passes).toBe(true);
    expect(report.measured).toEqual([360, 768, 1024, 1440]);
  });

  it('measures every width, because a page can be fine at one and broken at another', () => {
    const render = vi.fn((_document: BuilderDocument, width: QualityWidth) =>
      rendered(width + 100),
    );
    const report = runQualityGate(page(), { render });

    expect(render).toHaveBeenCalledTimes(4);
    /*
      Four issues, not one. "Overflows at 360" is a phone problem and "overflows
      everywhere" is a broken component — collapsing them throws away the fact
      that tells a person which they have.
    */
    expect(report.issues.filter((issue) => issue.check === 'overflow')).toHaveLength(4);
    expect(report.passes).toBe(false);
  });

  it('carries the DOM-free issues too, from the SAME implementation CI runs', () => {
    const empty = page();
    const stripped: BuilderDocument = {
      ...empty,
      nodes: {
        ...empty.nodes,
        s1: {
          id: 's1',
          type: 'customCode',
          props: {
            tree: { kind: 'root', children: [{ kind: 'element', tag: 'h2', text: 'Hero' }] },
          },
        },
      },
    };

    const report = runQualityGate(stripped, { render: () => rendered(300) });
    expect(report.issues.map((issue) => issue.check)).toContain('empty-section');
  });

  it('does NOT call an unrendered width a passing one', () => {
    const report = runQualityGate(page(), {
      render: (_document, width) => (width === 360 ? rendered(300) : undefined),
    });
    /*
      A gate that read "could not render" as "nothing wrong" would go green
      exactly when it stopped working.
    */
    expect(report.measured).toEqual([360]);
  });

  it('measures only the widths it was asked for', () => {
    const report = runQualityGate(page(), { render: () => rendered(300), widths: [1024] });
    expect(report.measured).toEqual([1024]);
  });

  it('passes the caller’s known anchors through to the document half', () => {
    const linked = page();
    const withLink: BuilderDocument = {
      ...linked,
      nodes: {
        ...linked.nodes,
        s1: {
          id: 's1',
          type: 'customCode',
          props: {
            tree: {
              kind: 'root',
              children: [
                { kind: 'element', tag: 'h2', text: 'Hero' },
                { kind: 'element', tag: 'p', text: 'Real copy.' },
                { kind: 'element', tag: 'a', text: 'Contact', attributes: { href: '#contact' } },
              ],
            },
          },
        },
      },
    };

    const without = runQualityGate(withLink, { render: () => rendered(300) });
    const with_ = runQualityGate(withLink, {
      render: () => rendered(300),
      knownAnchors: ['contact'],
    });

    expect(without.issues.map((issue) => issue.check)).toContain('internal-link');
    expect(with_.issues.map((issue) => issue.check)).not.toContain('internal-link');
  });
});
