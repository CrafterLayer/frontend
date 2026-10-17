# Design and UX audit — measured, not reviewed

A checklist is a memory of a decision. This is the decision, re-made on every run:
`apps/playground/src/app/ux-audit.stories.tsx` renders four real surfaces in Chromium and reports
every finding with the element, the rule and the number.

The surfaces: the **site builder**, the **assistant panel** (the real component, from a real kernel
— a panel audited from a hand-written approximation of itself proves nothing about the panel), the
**design-system panel**, and the **page navigator**.

## The rules, and where each stands

| Rule                    | What it measures                                                      | Proven to fail?       |
| ----------------------- | --------------------------------------------------------------------- | --------------------- |
| `accessible-name`       | every control has a name a screen reader can say                      | not yet constructed   |
| `target-size`           | ≥ 24×24 for pointer input (WCAG 2.2 minimum)                          | **yes**               |
| `cursor-pointer`        | a clickable thing says it is clickable                                | **yes**               |
| `contrast`              | text vs. the ground it is _actually_ on, gradient stops included      | **yes**               |
| `no-ground`             | the audit could not find a painted ground — reported, never assumed   | by construction       |
| `unverifiable-contrast` | nothing measurable to check — reported, never passed silently         | by construction       |
| `focus-ring`            | something visible changes on focus, on the element **or an ancestor** | fired once; see below |

`target-size` is 24 and not 44 on purpose. Forty-four is a TOUCH rule; this is a desktop builder
chrome whose controls sit in dense rows hit with a cursor, and WCAG 2.2's target-size (minimum) is
24×24 for pointer input. Claiming 44 here would mean a gate switched off the first time it was
inconvenient. A touch surface needs the other number and does not have one yet.

## What it found

**One real defect, in code nobody had looked at with a ruler.** `.bldr-site-pages__add` — the "Add
page" button — measured **67×20**, under the pointer minimum. It now carries
`min-block-size: var(--bldr-control-sm)`, which is the size every other small control in this shell
already is; the surface joined them rather than inventing a number.

## Three findings that were the GATE's own errors

Recorded because a gate that has been wrong is worth reading carefully, and because each one would
have sent the next reader to the wrong file.

1. **It invented a background.** With no ancestor painting an opaque ground it assumed white, and
   reported three confident 1.14:1 failures against a colour nobody painted. It now returns
   `no-ground` as a finding — "I could not measure this" is an answer; a fabricated ratio is not.
2. **It measured gradient text as transparent.** `.pg-chat__name` is painted with
   `background-clip: text`, so its computed `color` is `rgba(0,0,0,0)` and the ratio came out at
   1.22:1. This is also the case axe cannot check. It now measures the gradient's **stops** — if
   every stop clears the floor, every pixel between them does.
3. **It demanded a focus ring on the element itself.** The composer's textarea delegates its ring to
   the card by `:focus-within`, deliberately, so that tabbing to the send button does not move a
   ring off the thing a person is looking at. A rule that could not see a delegated ring would have
   pushed a good design into a worse one. It now compares the element and its nearest ancestors
   before and after focus.

## What is NOT claimed

`focus-ring` has been observed to fire on a real element and to stop firing once the delegated ring
was accounted for. It has **not** been shown to catch `outline: none` with no replacement on a field
whose ancestors do not react — several attempts left the gate green. It is written down as a rule
that caught something real, not as a guarantee.

`accessible-name` has never fired. It guards a case the surfaces do not currently contain.

## The layout defect a person found before the gate did

The site brief form was a card inside the assistant panel. `.pg-chat` declares grid rows for four
children; the form was a fifth, took the `1fr` track, and the conversation fell into an implicit row
and overflowed on top of it — reported first by the person using it, in the words "I can no longer
tell my writing from the replies".

It is now its own rail destination (`SiteBuilderPanel`). The layout fix is the smaller half of that:
**a site build is not a message.** A conversation is a sequence of turns someone reads back; a build
is a job with five stages, its own progress and its own Stop, and it stays interesting for minutes
after the sentence that started it. A job in a message list makes the job hard to watch and the list
hard to read.

The two destinations share exactly one thing — the run lease — so a site build and a page request
can never both believe they own the editor.
