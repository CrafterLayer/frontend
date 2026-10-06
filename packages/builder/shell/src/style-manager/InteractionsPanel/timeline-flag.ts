/**
 * Whether the Interactions panel shows the "Cinematic motion" section — the
 * named scroll-timeline picker (media-motion DESIGN §C.1, condition 2).
 *
 * OFF until the owner decides. The timeline engine today is GSAP 3.15.0 under
 * the GSAP Standard "No Charge" License (Webflow), which permits AI-generated
 * use and use on any website but prohibits no-code visual animation builders.
 * So recipes are agent-only (`motion.add`), and this manual picker — a select
 * of recipe NAMES, never a timeline or keyframe editor — stays hidden until
 * the owner answers open question Q1 (is CraftKit, or will it be, a paid
 * product?) and, if so, Webflow gives written consent. Flip it here only then.
 * Stories and tests opt in with the panel's `timelinePanel` prop instead.
 */
export const TIMELINE_PANEL_ENABLED = false as boolean;
