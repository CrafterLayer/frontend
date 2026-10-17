// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { instrumentSource } from '@craftkit/builder/code-runtime/compiler';
import type { RuntimeSnapshot } from '@craftkit/builder/code-runtime';
import { createReferenceCodePageSite } from './code-page-fixture';
import { runtimeSnapshotFromSite } from './code-runtime-client';
import { prepareStaticTextChange, staticTextValue } from './source-text-edit';

function snapshot(source: string): RuntimeSnapshot {
  const page = runtimeSnapshotFromSite(createReferenceCodePageSite(), 'home')!;
  page.project.files[page.entry] = { language: 'tsx', source };
  return page;
}

describe('source text editing', () => {
  it('edits the AST text span and preserves an attribute containing greater-than and comments', async () => {
    const page = snapshot(
      '/* keep */ export default () => <h1 title="a > b">Hello &amp; world</h1>; // keep',
    );
    const element = (
      await instrumentSource(page, page.entry, page.project.files[page.entry]!.source)
    ).elements[0]!;
    expect(staticTextValue(element)).toBe('Hello & world');
    const change = prepareStaticTextChange(page, element, 'New <text> {safe} & more');
    expect(change.file.source).toBe(
      '/* keep */ export default () => <h1 title="a > b">New &lt;text&gt; &#123;safe&#125; &amp; more</h1>; // keep',
    );
  });

  it('refuses a stale source handle even when the text still looks identical', async () => {
    const page = snapshot('export default () => <h1>Hello</h1>');
    const element = (
      await instrumentSource(page, page.entry, page.project.files[page.entry]!.source)
    ).elements[0]!;
    page.project.revision = 'new-revision';
    expect(() => prepareStaticTextChange(page, element, 'Changed')).toThrow(
      'older source revision',
    );
  });

  it('refuses dynamic, shared, or changed spans without touching source', async () => {
    const page = snapshot('export default () => <h1>Hello</h1>');
    const element = (
      await instrumentSource(page, page.entry, page.project.files[page.entry]!.source)
    ).elements[0]!;
    expect(() => prepareStaticTextChange(page, { ...element, dynamic: true }, 'Changed')).toThrow(
      'shared or dynamic',
    );
    expect(() =>
      prepareStaticTextChange(
        page,
        { ...element, handle: { ...element.handle, modulePath: 'shared/Header.tsx' } },
        'Changed',
      ),
    ).toThrow('shared or dynamic');
    page.project.files[page.entry]!.source = 'export default () => <h1>Other</h1>';
    expect(() => prepareStaticTextChange(page, element, 'Changed')).toThrow('no longer matches');
  });
});
