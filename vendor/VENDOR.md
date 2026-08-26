# Vendored code

Third-party builder code is **vendored, never depended on** (standing workspace decision):
copied here from a pinned commit with its license and provenance, and adapted deliberately
inside our own packages. Nothing under `vendor/` is compiled, linted, bundled, or imported —
these files exist so the derivation is auditable.

License texts: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## puck — inline text editing on the canvas

| | |
| --- | --- |
| Upstream | [puckeditor/puck](https://github.com/puckeditor/puck) |
| File | `packages/core/components/InlineTextField/index.tsx` |
| Commit | `84e1764016d6c7fbb7dc5653c384de74fbd3e667` (2026-08-21) |
| License | MIT — `vendor/puck/LICENSE` |
| Verbatim copy | `vendor/puck/InlineTextField.upstream.tsx` |
| Adapted into | `packages/builder/shell/src/components/InlineTextSurface/` |

**Why vendored rather than reimplemented**: the file encodes three behaviors that are cheap to
copy and expensive to rediscover —

1. **Caret-safe value sync**: write the editable DOM only when the incoming value differs from
   what is displayed (`if (safeValue !== ref.current.innerText) ref.current.replaceChildren(...)`).
   Rewriting the DOM for your own echo resets the caret mid-typing.
2. **Safari drag-focus defense**: `contentEditable` is `"plaintext-only"` only while hovered or
   focused, because Safari focuses contenteditables during a drag
   ([webkit 112854](https://bugs.webkit.org/show_bug.cgi?id=112854)). Our nodes carry drag
   machinery too, so the same hazard applies.
3. **Nullish coercion**: `replaceChildren` stringifies non-Node arguments, so an unguarded
   `null`/`undefined` renders the literal text `"null"`.

**What we changed in the adaptation** (and why):

- **Commit law**: upstream writes the store on every `input` event. Ours dispatches through the
  kernel door with the workspace's one-transaction-per-commit law, so undo granularity and the
  `transactions ≡ commits` gate hold.
- **No Puck store/portal coupling**: `useAppStoreApi`, `resolveAndReplaceData`, `setDeep`,
  `getSelectorForId`, `registerOverlayPortal`, and `getClassNameFactory` are replaced by props
  and our own overlay conventions.
- **Selection**: upstream sets its own UI selector on click-capture; ours leaves selection to
  the canvas's existing kernel-selection path.
- **Styling**: CSS modules replaced by our `--bldr-*` token stylesheet.

## tiptap — bubble-menu logic (logic only, no file copied)

| | |
| --- | --- |
| Upstream | [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) |
| Reference | `packages/extension-bubble-menu/src/bubble-menu-plugin.ts` (v3.30.x) |
| License | MIT — see THIRD_PARTY_LICENSES.md |
| Adapted into | `packages/builder/extensions/richtext/src/InlineRichText/` |

Two ideas are reimplemented from the upstream plugin, with attribution in the adapting file:
its default `shouldShow` predicate (hide on empty selection, on an empty text block, and while
the menu itself owns focus) and its selection→rect derivation (`posToDOMRect`, with the
node-selection special case). No code is copied and **no package is added**: `posToDOMRect` and
`isTextSelection` already ship inside the pinned `@tiptap/core@3.30.3`.

The extension's own dependency (`@floating-ui/dom`) is deliberately NOT adopted — see
`specs/workspace/009-builder-b3c-inline-editing/research.md` R2 for the decision and the
conditions under which it would be revisited.
