# Contract: Asset Library

**Owners**: `@craftkit/builder-schema` (layer 0, the contract), `@craftkit/builder-ai` (layer 2,
selection), `apps/playground` (the local implementation)

The requester's decision: imagery is **selected** from a project library, never generated and never
invented. The library is local now; a backend with uploads replaces the source later without
touching selection.

---

## 1. The port

```ts
export interface AssetLibraryPort {
  list(options?: { signal?: AbortSignal }): Promise<readonly AssetEntry[]>;
}
```

One method, deliberately. Everything the agent needs is "what is available", and a narrower surface
is a smaller thing for a future backend to implement correctly (FR-050).

Upload is **not** on this port. Uploading is the host's concern; its only obligation is that an
uploaded image subsequently appears in `list()`.

---

## 2. The entry

```ts
export interface AssetEntry {
  id: AssetId;
  url: string; // supplied by the port — never authored by the agent
  description: string; // the agent's basis for choosing (FR-046)
  mood: readonly string[]; // "warm", "clinical", "industrial", …
  palette: readonly string[]; // dominant colours, matched against the design system
  alt: string; // required (FR-048)
  width: number;
  height: number;
}
```

`description`, `mood`, and `palette` exist because FR-046 requires selection to be _directed_ by the
business description and _consistent_ with the design system. Without metadata, "consistent with the
palette" is unmeasurable and selection degrades to picking the first entry.

`alt` is on the entry, not on the block, so a correct `alt` cannot be forgotten at placement time. A
block may override it when context demands something more specific.

---

## 3. Storage in the site

```ts
interface BuilderSite {
  assets: Readonly<Record<AssetId, AssetEntry>>;
}
```

Selected assets are copied into the site's asset table by a `registerAsset` command. Blocks
reference `{ assetId }`.

**Why copied rather than referenced live**: a site must render identically tomorrow. If pages
pointed at the live library, a library edit would silently restyle finished sites, and the
round-trip law would be false for anything not in the projection.

---

## 4. The invariant

> **Every `AssetRef` in every page and every shared region must resolve to an entry in
> `site.assets`.**

Enforced in three places, on purpose:

1. `validateSite()` — issue code `unresolved-asset-reference`.
2. The assembly stage — a command introducing an unresolvable reference is rejected in the scratch
   kernel, so it never reaches the live door.
3. A property test — over generated sites, the count of unresolvable references is **zero**.

This is what turns SC-012 ("zero invented addresses") into a measured property rather than a hope.
It is structural: the agent cannot emit a URL at all, only an `assetId`, and an id it was not given
does not resolve.

---

## 5. Deliberate absence

FR-047 requires a real asset **or a stated deliberate absence** — never an unfilled placeholder.

```ts
// A block's image prop, in full:
type ImageProp = AssetRef | { absent: true; reason: string };
```

`{ absent: true, reason }` is what FR-051 produces when the library is empty, unavailable, or holds
nothing suitable. It renders as labelled text, not a grey box and not a broken image. A grey
placeholder is not a valid value in this union, which is the point.

---

## 6. Failure behaviour

| Situation                                      | Behaviour                                                         | Requirement |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| `list()` rejects or times out                  | Generation completes; affected positions get `{ absent, reason }` | FR-051      |
| Library returns `[]`                           | Same                                                              | FR-051      |
| No asset matches the design system             | Same, with a reason naming the mismatch                           | FR-051      |
| An asset disappears after a site referenced it | Page shows a labelled missing asset; the **site stays valid**     | Edge case   |

That last row is why the site copies entries rather than resolving live: a vanished library asset
degrades one image, it does not invalidate a document.

---

## 7. Implementations

| Implementation       | Where                                                         | Notes                                                                                    |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Local library        | `apps/playground/src/features/preview/local-asset-library.ts` | This feature. A fixed set with real metadata.                                            |
| Deterministic double | `@craftkit/builder-ai/testing`                                | Fixed entries so selection is reproducible under a seed.                                 |
| Backend-backed       | Later, host-owned                                             | Implements the same `list()`. Uploads join the same library. **No change to selection.** |

---

## 8. Known limitation, stated rather than hidden

SC-004 measures that generated sites differ meaningfully across unrelated businesses — palette, type
pairing, page set, section order. **Imagery is deliberately excluded from that measure** while the
library is small, because variety is bounded by the library rather than by the agent. This is
recorded in the spec's Assumptions, and it is the honest reading: with a ten-image library, two
generated sites _will_ share images, and pretending otherwise would make SC-004 a test that passes
by being weak.
