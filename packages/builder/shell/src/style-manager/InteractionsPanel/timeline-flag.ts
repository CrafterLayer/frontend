/**
 * Whether the Interactions panel shows the "Cinematic motion" section
 * («حركة سينمائية») — the recipe-name picker for `data-ck-timeline`
 * (media-motion DESIGN §C.1, condition 2; gsap-pixi SPEC, 2026-10-08).
 *
 * ON. The timeline engine is now an MIT library: an anime.js 4.5.0 subset
 * (vendor/animejs, `renderer/src/engines/timeline-source.ts`), which carries no
 * restriction on visual or no-code animation tools. GSAP is gone: its Standard
 * "No Charge" licence prohibited exactly this picker in a no-code builder
 * (durable/gsap-pixi/LICENCE.md). The picker still offers recipe NAMES only
 * (`CUSTOM_CODE_TIMELINE_RECIPES` + `data-ck-scrub`), never a timeline or
 * keyframe editor. Set it to false to hide the section; stories and tests can
 * still opt in with the panel's `timelinePanel` prop.
 */
export const TIMELINE_PANEL_ENABLED = true as boolean;
