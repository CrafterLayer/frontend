import { LOGO_DESIGN_SKILL } from './logo-design';
import type { AiSkillDefinitionV1 } from './types';

/**
 * Verified art by name (2026-10-14): brand logos, cartoon characters and illustrations, written
 * as a name where an image src goes and resolved by the tool. Split out of photo-direction,
 * which is explicit-only and so never reached an edit: "Add our client logos: Visa, Stripe" and
 * «ضيف شعارات العملاء» got the floor alone. Auto here on the art's own words; photo-direction
 * depends on it, so every section writer still carries these lines.
 *
 * Never on «شعار» alone, which is also a slogan (copywriting's word); a person's OWN logo is
 * `craftkit.logo-design`, an original drawing, never a `logo:` name.
 */
export const ART_NAMES_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.art-names',
  name: 'Art by name',
  description: 'Verified logos, cartoon characters and illustrations, named where an image goes.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 47,
  activation: {
    mode: 'auto',
    intents: ['edit', 'add-section', 'build-page', 'build-site'],
    keywords: [
      'client logos',
      'partner logos',
      'payment logos',
      'logo strip',
      'logos',
      'avatar',
      'avatars',
      'mascot',
      'cartoon character',
      'cartoon characters',
      'illustration',
      'illustrations',
      'شعارات',
      'شعار الشركة',
      'لوجو',
      'لوجوهات',
      'شخصية كرتونية',
      'شخصيات كرتونية',
      'رسومات توضيحية',
      'رسومات',
    ],
  },
  tags: ['content', 'images', 'art'],
  instructions: `ART by name, verified: write the name where an image src goes (a kit image slot {"src":"illustration:doctor"}, part.image src, image.set subject, media.add images [{"src":"logo:visa"}]); the tool writes the address and an alt in the page language. Never type a simpleicons, dicebear or iconify address yourself.
- 'logo:<brand>' ('/white' on a dark band): only a brand the request names — client, partner, integration, payment method, app store. Logos are their owners' trademarks: never the owner's own (no upload → their name as text, and followUp asks for the file); a refused brand stays a name.
- 'character:<style>:<seed>', a cartoon (notionists, lorelei, open-peeps, avataaars, thumbs, pixel-art, bottts): sample team members, testimonial authors, a story's cast. The seed is the person's name, so one person looks the same everywhere.
- 'illustration:<words>', English or Arabic (doctor, coffee, car, rocket, «طبيب»): feature, step and empty-state pictures; never a stand-in for a real place, dish or product.`,
};

/** The art skills in priority order, for the built-in list (builtins.ts). */
export const ART_SKILLS: readonly AiSkillDefinitionV1[] = [LOGO_DESIGN_SKILL, ART_NAMES_SKILL];
