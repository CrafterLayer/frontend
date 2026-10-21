import {
  SITE_BEHAVIOR_EDIT_TEACHING,
  SITE_BEHAVIOR_KEYWORDS,
  SITE_BEHAVIOR_TEACHING,
} from './site-behaviors';
import type { AiSkillDefinitionV1 } from './types';

/**
 * Restrained motion the renderer can actually run: transition utilities,
 * keyframes in pageCss, reduced-motion guards. Auto on animation verbs;
 * "animate" reaches "animated" and "animating" through the matcher's endings.
 */
export const MOTION_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.motion',
  name: 'Motion and interaction',
  description:
    'Restrained motion the renderer can run: transition and hover utilities, animate-in entrances, keyframes in pageCss, reduced-motion guards, CSS-only lift, reveal and marquee, and the ready site behaviours.',
  version: '1.7.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 45,
  activation: {
    mode: 'auto',
    keywords: [
      'animate',
      'animation',
      'motion',
      'hover effect',
      'parallax',
      'keyframe',
      'transition',
      'scroll reveal',
      'marquee',
      'gsap',
      'تحريك',
      'متحرك',
      'حركة',
      'حركات',
      'أنيميشن',
      'تأثيرات',
      // everyday site behaviours (2026-10-13): the interactions a pack runs, asked for by name.
      ...SITE_BEHAVIOR_KEYWORDS,
    ],
  },
  tags: ['animation', 'interaction', 'motion'],
  instructions: `Motion follows the requested interaction, hierarchy and measured cost; choose effect count for that purpose. Keep reading and essential controls stable, and let people pause persistent automatic motion.
TIMING EXAMPLES, adapt to the task: micro interactions transition-colors duration-200 ease-out; card lift duration-300; entrance reveal 0.6s ease-out; ambient loops 8s to 20s linear infinite.
HOVER on cards: transition duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none; hover:scale-105 for media. A lift tied to the site shadow token: class ck-lift with css .ck-lift:hover{transform:translateY(-4px);box-shadow:var(--t-shadow-elevated)}.
ENTRANCE ON LOAD needs no css: class='animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none' (zoom-in-95 or slide-in-from-start-8 for a card; delay-150, delay-300 stagger siblings); the page already stops it under reduced motion, the motion-reduce class says so in the markup. KEYFRAMES, for anything else, live in pageCss on the page root (they pass scoping unchanged and are declared once): @keyframes ck-fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}. Apply from the region css: .ck-fade-up{animation:ck-fade-up .6s ease-out both}; stagger with .ck-d1{animation-delay:.1s} .ck-d2{animation-delay:.2s} .ck-d3{animation-delay:.3s}.
GUARD every animated rule in the same sheet: @media (prefers-reduced-motion:reduce){.ck-fade-up,.ck-marquee-track{animation:none}}.
SCROLL REVEAL without JavaScript: @supports (animation-timeline: view()){.ck-fade-up{animation-timeline:view();animation-range:entry 0% entry 40%}}; elsewhere it plays on load.
MARQUEE: prefer the marquee block when present; otherwise div overflow-hidden > div ck-marquee-track flex gap-12 whitespace-nowrap with the items duplicated once, css .ck-marquee-track{animation:ck-marquee 20s linear infinite} and keyframes translateX(0) to translateX(-50%) in pageCss.
HOVER REVEALS: group on the card and group-hover:translate-x-1 on its arrow; for a reveal, .ck-card .ck-meta{opacity:0;transition:opacity .2s} .ck-card:hover .ck-meta{opacity:1}.
PARALLAX: in css, background-attachment:fixed on a background-image region only inside @media (min-width:768px); phones get a static image.
Prefer transform and opacity for efficient movement. Other supported animated properties are valid when required by the design; avoid costly layout shifts, measure performance and keep a complete reduced-motion state.
GSAP, SCROLL REVEALS AND TIMELINES go through the motion tool, never through attributes you write: {"command":"tool","args":{"name":"motion.add","input":{"id":"<region id>","recipe":"stagger-in"}}}, one step per section (recipes: fade-in, slide-in, stagger-in, split-reveal, parallax-depth, scrub-scale). Never write data-ck-motion or data-ck-timeline yourself, and never put "attributes" inside "set".
${SITE_BEHAVIOR_TEACHING}
${SITE_BEHAVIOR_EDIT_TEACHING}`,
  references: {
    'checks/motion.md':
      "Motion serves the task without an effect quota; an entrance may use animate-in with motion-reduce:animate-none; keyframes in pageCss, applied from region css; prefers-reduced-motion guard present; efficient properties preferred; a hover lift moves transform and shadow one step, never layout; group-hover only on a card's own children; requested visual styles remain available.",
  },
};
