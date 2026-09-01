import type { DeclarativeExtensionManifest } from '@craftkit/builder-schema';

/**
 * Original, token-bound landing-page templates built from the marketing pack.
 * They follow the common Tailwind marketing-section taxonomy without copying
 * licensed Tailwind Plus source. Every insert is detached by the kernel.
 */
export const marketingTemplates: DeclarativeExtensionManifest = {
  tier: 2,
  name: 'blocks-marketing-templates',
  version: '1.0.0',
  contributes: {
    compositions: [
      {
        id: 'saas-launch',
        name: 'SaaS launch',
        version: 1,
        surfaces: ['site'],
        rootId: 'saas-root',
        nodes: {
          'saas-root': {
            id: 'saas-root',
            type: 'stack',
            props: { direction: 'column', gap: 'none', width: 'full' },
            slots: {
              default: [
                'saas-hero',
                'saas-carousel',
                'saas-logos',
                'saas-bento',
                'saas-stats',
                'saas-content',
                'saas-video',
                'saas-quotes',
                'saas-comparison',
                'saas-faq',
                'saas-newsletter',
              ],
            },
          },
          'saas-hero': {
            id: 'saas-hero',
            type: 'hero',
            props: {
              variant: 'centered',
              eyebrow: 'The operating system for modern product teams',
              heading: 'Turn scattered work into clear momentum',
              body: 'Plan, ship, and learn in one calm workspace that keeps every decision connected to the outcome.',
              trustLine: 'Start free · No credit card · Set up in under five minutes',
              align: 'center',
              tone: 'light',
              spacing: 'lg',
              width: 'wide',
            },
            slots: { actions: ['saas-primary', 'saas-secondary'] },
          },
          'saas-primary': {
            id: 'saas-primary',
            type: 'cta',
            props: { label: 'Start building', href: '#pricing', emphasis: 'primary', size: 'lg' },
          },
          'saas-secondary': {
            id: 'saas-secondary',
            type: 'cta',
            props: { label: 'Watch the overview', href: '#product', emphasis: 'ghost', size: 'lg' },
          },
          'saas-carousel': {
            id: 'saas-carousel',
            type: 'carousel',
            props: {
              eyebrow: 'Inside the workflow',
              heading: 'See focus move from plan to measurable outcome',
              body: 'A clear view for each stage, with the context preserved between them.',
              variant: 'split',
              mediaPosition: 'end',
              mediaAspect: 'wide',
              autoplay: false,
              showControls: true,
              showIndicators: true,
              items: [
                {
                  label: '01 · Plan',
                  title: 'Turn ambiguity into an executable brief',
                  body: 'Align the outcome, evidence, constraints, and ownership before delivery begins.',
                  imageSrc:
                    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'Team reviewing a focused product plan around a table',
                  action: { label: 'Explore planning', href: '#planning' },
                },
                {
                  label: '02 · Build',
                  title: 'Keep the decisions beside the work',
                  body: 'Give contributors enough context to move without another status meeting.',
                  imageSrc:
                    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'Collaborative team working together in a bright studio',
                  action: { label: 'See delivery views', href: '#delivery' },
                },
                {
                  label: '03 · Learn',
                  title: 'Close the loop on what changed',
                  body: 'Connect releases to adoption and customer evidence before the next cycle starts.',
                  imageSrc:
                    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'Analytics dashboard showing product outcome trends',
                  action: { label: 'View outcome tracking', href: '#outcomes' },
                },
              ],
            },
          },
          'saas-logos': {
            id: 'saas-logos',
            type: 'logoCloud',
            props: {
              eyebrow: 'Trusted by focused teams',
              heading: 'From first launch to global scale',
              variant: 'minimal',
              columns: '6',
              tone: 'transparent',
              items: [
                { name: 'Northstar', descriptor: 'Analytics' },
                { name: 'Kinetic', descriptor: 'Infrastructure' },
                { name: 'Luma', descriptor: 'Design systems' },
                { name: 'Arcform', descriptor: 'Operations' },
                { name: 'Canopy', descriptor: 'Collaboration' },
                { name: 'Meridian', descriptor: 'Commerce' },
              ],
            },
          },
          'saas-bento': {
            id: 'saas-bento',
            type: 'bento-grid',
            props: {
              eyebrow: 'Everything stays connected',
              heading: 'A workspace that gets out of your team’s way',
              body: 'Purpose-built views create focus without hiding the context behind each decision.',
              layout: 'mosaic',
              items: [
                {
                  kicker: 'Planning',
                  title: 'One living roadmap',
                  body: 'Connect opportunities, priorities, and delivery without rebuilding the story for every meeting.',
                  metric: '3.4×',
                  size: 'featured',
                  emphasis: 'inverse',
                },
                {
                  kicker: 'Signals',
                  title: 'Feedback with context',
                  body: 'Turn customer evidence into decisions while the details are still fresh.',
                  size: 'tall',
                  emphasis: 'accent',
                },
                {
                  kicker: 'Delivery',
                  title: 'Clear ownership',
                  body: 'Every outcome has a next action and a person moving it forward.',
                  size: 'small',
                  emphasis: 'neutral',
                },
                {
                  kicker: 'Learning',
                  title: 'Measure what shipped',
                  body: 'Close the loop with release notes, adoption signals, and a visible result.',
                  size: 'wide',
                  emphasis: 'neutral',
                },
              ],
            },
          },
          'saas-stats': {
            id: 'saas-stats',
            type: 'stats',
            props: {
              eyebrow: 'Momentum you can measure',
              heading: 'Less coordination. More meaningful progress.',
              body: 'Teams replace status work with a shared system everyone can trust.',
              variant: 'contrast',
              headerLayout: 'split',
              items: [
                {
                  value: '42%',
                  label: 'Faster launches',
                  detail: 'From approved brief to production',
                },
                { value: '8.1h', label: 'Saved each week', detail: 'Per product lead' },
                {
                  value: '91%',
                  label: 'Roadmap clarity',
                  detail: 'Reported across customer teams',
                },
                { value: '24/7', label: 'Shared visibility', detail: 'Across every timezone' },
              ],
            },
          },
          'saas-content': {
            id: 'saas-content',
            type: 'content-section',
            props: {
              eyebrow: 'Built for the real workflow',
              heading: 'See the whole product story in one place',
              body: 'Strategy, research, delivery, and learning stay linked. Your team can move quickly without losing why the work matters.',
              layout: 'editorial',
              highlights: [
                {
                  title: 'Connected decisions',
                  body: 'Trace every release back to the evidence that shaped it.',
                },
                {
                  title: 'Calm collaboration',
                  body: 'Give each person the context they need without another meeting.',
                },
                {
                  title: 'Flexible views',
                  body: 'Switch from executive narrative to delivery detail instantly.',
                },
                {
                  title: 'Visible outcomes',
                  body: 'Keep the result beside the work, not in a separate report.',
                },
              ],
              link: { label: 'Explore the product', href: '#product' },
            },
          },
          'saas-video': {
            id: 'saas-video',
            type: 'videoSection',
            props: {
              eyebrow: 'Motion, with restraint',
              heading: 'Preview a focused visual story without distracting the page',
              body: 'A silent nature study demonstrates responsive framing and native playback while final product media is prepared.',
              src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
              videoLabel: 'Silent close-up motion study of a flower',
              caption: 'A silent macro nature study used as a playback-ready example.',
              cta: { label: 'Explore the workflow', href: '#product', newTab: false },
              layout: 'split',
              mediaPosition: 'end',
              preload: 'metadata',
              muted: true,
              loop: true,
            },
          },
          'saas-quotes': {
            id: 'saas-quotes',
            type: 'testimonials',
            props: {
              eyebrow: 'Customer stories',
              heading: 'A calmer way for ambitious teams to ship',
              body: 'The strongest signal is what changes after the workspace goes live.',
              variant: 'spotlight',
              columns: '3',
              items: [
                {
                  quote: 'We finally have one place where the roadmap and the reasoning agree.',
                  author: 'Maya Chen',
                  role: 'VP Product',
                  company: 'Northstar',
                  rating: 5,
                },
                {
                  quote: 'Planning now takes hours, not days, and the team leaves aligned.',
                  author: 'Omar Haddad',
                  role: 'Product Lead',
                  company: 'Kinetic',
                  rating: 5,
                },
                {
                  quote: 'The system feels rigorous without slowing anyone down.',
                  author: 'Lea Morgan',
                  role: 'COO',
                  company: 'Luma',
                  rating: 5,
                },
              ],
            },
          },
          'saas-comparison': {
            id: 'saas-comparison',
            type: 'comparisonTable',
            props: {
              eyebrow: 'Simple pricing',
              heading: 'Choose the room your team needs',
              body: 'Every plan includes the complete workflow. Upgrade when collaboration grows.',
              plans: [
                {
                  name: 'Starter',
                  description: 'For a focused team',
                  price: '$19',
                  period: '/ month',
                  actionLabel: 'Start free',
                  actionHref: '#signup',
                },
                {
                  name: 'Scale',
                  description: 'For growing organizations',
                  price: '$49',
                  period: '/ month',
                  badge: 'Most popular',
                  actionLabel: 'Start free',
                  actionHref: '#signup',
                  featured: true,
                },
                {
                  name: 'Enterprise',
                  description: 'For complex operations',
                  price: 'Custom',
                  actionLabel: 'Talk to sales',
                  actionHref: '#contact',
                },
              ],
              rows: [
                {
                  feature: 'Unlimited projects',
                  values: ['Included', 'Included', 'Included'],
                  highlight: true,
                },
                { feature: 'Guest collaborators', values: ['5', 'Unlimited', 'Unlimited'] },
                { feature: 'Advanced permissions', values: ['—', 'Included', 'Included'] },
                { feature: 'Dedicated success lead', values: ['—', '—', 'Included'] },
              ],
              note: 'All prices exclude applicable taxes. Cancel whenever you need.',
            },
          },
          'saas-faq': {
            id: 'saas-faq',
            type: 'faq',
            props: {
              eyebrow: 'Questions, answered',
              heading: 'Everything you need before you start',
              variant: 'cards',
              layout: 'columns',
              openFirst: true,
              items: [
                {
                  question: 'Can we import our current roadmap?',
                  answer:
                    'Yes. Start with CSV, then connect the tools your team already uses as you settle into the workflow.',
                },
                {
                  question: 'Do guests need paid seats?',
                  answer:
                    'No. Invite customers and partners to the specific spaces where their context is useful.',
                },
                {
                  question: 'Can we change plans later?',
                  answer: 'Upgrade or downgrade at any time. Your work and history remain intact.',
                },
                {
                  question: 'Is there an enterprise security review?',
                  answer:
                    'Yes. The enterprise plan includes security documentation, SSO, and a guided review.',
                },
              ],
            },
          },
          'saas-newsletter': {
            id: 'saas-newsletter',
            type: 'newsletter',
            props: {
              eyebrow: 'Product thinking, once a month',
              heading: 'Build a product practice people trust',
              body: 'One practical letter on clearer decisions, calmer teams, and launches that move the business.',
              buttonLabel: 'Join the letter',
              privacy: 'No noise. Unsubscribe in one click.',
              variant: 'split',
              action: '/subscribe',
            },
          },
        },
      },
      {
        id: 'creative-agency',
        name: 'Creative agency',
        version: 1,
        surfaces: ['site'],
        rootId: 'agency-root',
        nodes: {
          'agency-root': {
            id: 'agency-root',
            type: 'stack',
            props: { direction: 'column', gap: 'none', width: 'full' },
            slots: {
              default: [
                'agency-note',
                'agency-hero',
                'agency-stats',
                'agency-work',
                'agency-portfolio',
                'agency-gallery',
                'agency-process',
                'agency-team',
                'agency-quotes',
                'agency-blog',
                'agency-contact',
              ],
            },
          },
          'agency-note': {
            id: 'agency-note',
            type: 'announcementBar',
            props: {
              label: 'Now booking',
              message: 'A limited number of Q4 brand and digital projects are open.',
              linkLabel: 'Start a conversation',
              href: '#contact',
              emphasis: 'inverse',
              layout: 'split',
            },
          },
          'agency-hero': {
            id: 'agency-hero',
            type: 'hero',
            props: {
              variant: 'editorial',
              eyebrow: 'Independent creative studio',
              heading: 'We make ambitious ideas impossible to ignore',
              body: 'Strategy, identity, and digital experiences for organizations moving culture forward.',
              trustLine: 'Strategy · Brand systems · Digital products',
              align: 'start',
              tone: 'light',
              spacing: 'lg',
              width: 'wide',
            },
            slots: { actions: ['agency-primary', 'agency-link'] },
          },
          'agency-primary': {
            id: 'agency-primary',
            type: 'cta',
            props: { label: 'See selected work', href: '#work', emphasis: 'primary', size: 'lg' },
          },
          'agency-link': {
            id: 'agency-link',
            type: 'cta',
            props: {
              label: 'Our capabilities',
              href: '#capabilities',
              emphasis: 'link',
              size: 'lg',
            },
          },
          'agency-stats': {
            id: 'agency-stats',
            type: 'stats',
            props: {
              eyebrow: 'Small team, serious reach',
              heading: 'Senior thinking stays close to the work',
              variant: 'minimal',
              items: [
                { value: '14', label: 'Global launches', detail: 'In the last twelve months' },
                { value: '11', label: 'Design awards', detail: 'Across identity and digital' },
                { value: '92%', label: 'Referral-led', detail: 'Clients who return or recommend' },
              ],
            },
          },
          'agency-work': {
            id: 'agency-work',
            type: 'bento-grid',
            props: {
              eyebrow: 'Selected work',
              heading: 'Distinct systems built for real growth',
              body: 'Each engagement starts with the business problem and ends with a system the team can own.',
              items: [
                {
                  kicker: 'Fintech',
                  title: 'A trusted identity for a new kind of bank',
                  body: 'Positioning, identity, product language, and launch.',
                  metric: '+61%',
                  size: 'featured',
                  emphasis: 'inverse',
                },
                {
                  kicker: 'Culture',
                  title: 'A digital home for contemporary art',
                  body: 'Editorial platform and exhibition experience.',
                  size: 'tall',
                  emphasis: 'accent',
                },
                {
                  kicker: 'Climate',
                  title: 'Turning complex science into public action',
                  body: 'Narrative, data storytelling, and campaign toolkit.',
                  size: 'wide',
                  emphasis: 'neutral',
                },
              ],
            },
          },
          'agency-portfolio': {
            id: 'agency-portfolio',
            type: 'portfolioGrid',
            props: {
              eyebrow: 'Case studies',
              heading: 'Work that changed what the business could do next',
              body: 'Selected partnerships across strategy, identity, and digital product design.',
              actionLabel: 'Read the case study',
              showMetrics: true,
              variant: 'editorial',
              columns: '2',
              items: [
                {
                  category: 'Financial technology',
                  title: 'A trusted identity for a new kind of bank',
                  summary:
                    'A distinct brand and product system built for a category where confidence is everything.',
                  imageSrc:
                    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'A refined financial dashboard with clear outcome data',
                  href: '#case-fintech',
                  metrics: [
                    { label: 'Qualified demand', value: '+61%' },
                    { label: 'Activation', value: '+24%' },
                  ],
                },
                {
                  category: 'Culture',
                  title: 'A digital home for contemporary art',
                  summary:
                    'An editorial platform that gives exhibitions, artists, and visitors room to breathe.',
                  imageSrc:
                    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'Contemporary artwork presented in a spacious gallery',
                  href: '#case-culture',
                  metrics: [
                    { label: 'Visit depth', value: '+38%' },
                    { label: 'Membership', value: '+17%' },
                  ],
                },
              ],
            },
          },
          'agency-gallery': {
            id: 'agency-gallery',
            type: 'gallery',
            props: {
              eyebrow: 'The work, up close',
              heading: 'Systems with range, details with intent',
              body: 'A closer look at the moments where strategy becomes something people can see and use.',
              layout: 'editorial',
              columns: '3',
              aspect: 'landscape',
              showCaptions: true,
              captionStyle: 'below',
              items: [
                {
                  src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1600&q=80',
                  alt: 'Architectural identity expressed through a restrained modern facade',
                  caption: 'A flexible identity built for recognition without repetition.',
                  featured: true,
                },
                {
                  src: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80',
                  alt: 'Design team reviewing a product system in a bright studio',
                  caption: 'Product language and interface moving as one system.',
                },
                {
                  src: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1600&q=80',
                  alt: 'Campaign design details arranged across a creative workspace',
                  caption: 'A launch expression designed to earn attention in context.',
                },
              ],
            },
          },
          'agency-process': {
            id: 'agency-process',
            type: 'processSteps',
            props: {
              eyebrow: 'How we work',
              heading: 'Clarity before decoration',
              body: 'A compact senior team stays with the work from the first question through launch.',
              variant: 'accented',
              steps: [
                {
                  meta: '01',
                  title: 'Find the sharp question',
                  body: 'Research the audience, market, and internal ambition until the opportunity is clear.',
                },
                {
                  meta: '02',
                  title: 'Build the point of view',
                  body: 'Turn insight into a narrative and creative direction with room to grow.',
                },
                {
                  meta: '03',
                  title: 'Make the system real',
                  body: 'Design the identity and experience across the moments that matter.',
                },
                {
                  meta: '04',
                  title: 'Launch with confidence',
                  body: 'Equip the team, ship the work, and learn from how people respond.',
                },
              ],
            },
          },
          'agency-team': {
            id: 'agency-team',
            type: 'team',
            props: {
              eyebrow: 'The people in the room',
              heading: 'Senior collaborators, from start to finish',
              body: 'No handoff maze. The people shaping the strategy are the people making the work.',
              variant: 'editorial',
              columns: '3',
              members: [
                {
                  name: 'Nora Vale',
                  role: 'Strategy Director',
                  bio: 'Turns research and complexity into a precise point of view.',
                },
                {
                  name: 'Adam Rowe',
                  role: 'Creative Director',
                  bio: 'Builds identities with enough character to become culture.',
                },
                {
                  name: 'Mina Saleh',
                  role: 'Design Director',
                  bio: 'Connects brand systems to elegant, useful digital products.',
                },
              ],
            },
          },
          'agency-quotes': {
            id: 'agency-quotes',
            type: 'testimonials',
            props: {
              eyebrow: 'Long-term partners',
              heading: 'The kind of collaboration people remember',
              variant: 'wall',
              columns: '2',
              items: [
                {
                  quote:
                    'They found the one idea that brought our product, culture, and story together.',
                  author: 'Elena Park',
                  role: 'CMO',
                  company: 'Meridian',
                  rating: 5,
                },
                {
                  quote: 'The work was brave, commercially sharp, and genuinely ours.',
                  author: 'Daniel Ross',
                  role: 'Founder',
                  company: 'Common Ground',
                  rating: 5,
                },
              ],
            },
          },
          'agency-blog': {
            id: 'agency-blog',
            type: 'blogGrid',
            props: {
              eyebrow: 'Studio notes',
              heading: 'What we are noticing',
              body: 'Short observations on brands, products, and the culture around them.',
              variant: 'editorial',
              columns: '3',
              showImages: false,
              posts: [
                {
                  title: 'Why distinctiveness beats consistency',
                  excerpt:
                    'The best systems create recognition without making every expression identical.',
                  href: '#journal-1',
                  category: 'Brand',
                  author: 'Nora Vale',
                  publishedLabel: '12 Jun',
                  readingTime: '5 min',
                },
                {
                  title: 'Designing trust before polish',
                  excerpt: 'Where credibility actually comes from in early-stage digital products.',
                  href: '#journal-2',
                  category: 'Product',
                  author: 'Mina Saleh',
                  publishedLabel: '28 May',
                  readingTime: '7 min',
                },
                {
                  title: 'A useful tension in every brief',
                  excerpt: 'How to keep commercial clarity and creative surprise in the same room.',
                  href: '#journal-3',
                  category: 'Practice',
                  author: 'Adam Rowe',
                  publishedLabel: '09 May',
                  readingTime: '4 min',
                },
              ],
            },
          },
          'agency-contact': {
            id: 'agency-contact',
            type: 'contact',
            props: {
              eyebrow: 'Start a project',
              heading: 'Tell us what needs to change',
              body: 'Share the ambition, the challenge, and where you are today. We will reply with a clear next step.',
              email: 'hello@example.com',
              availability: 'Currently booking projects starting in October.',
              formTitle: 'A few details are enough',
              formBody: 'You do not need a perfect brief. Start with what you know.',
              formAction: '/contact',
              variant: 'split',
            },
          },
        },
      },
      {
        id: 'commerce-launch',
        name: 'Commerce launch',
        version: 1,
        surfaces: ['site', 'store'],
        rootId: 'shop-root',
        nodes: {
          'shop-root': {
            id: 'shop-root',
            type: 'stack',
            props: { direction: 'column', gap: 'none', width: 'full' },
            slots: {
              default: [
                'shop-note',
                'shop-hero',
                'shop-products',
                'shop-logos',
                'shop-features',
                'shop-content',
                'shop-stats',
                'shop-quotes',
                'shop-comparison',
                'shop-faq',
                'shop-promo',
                'shop-newsletter',
              ],
            },
          },
          'shop-note': {
            id: 'shop-note',
            type: 'announcementBar',
            props: {
              label: 'Launch week',
              message: 'Complimentary express delivery on every order.',
              linkLabel: 'Shop the collection',
              href: '#collection',
              emphasis: 'accent',
            },
          },
          'shop-hero': {
            id: 'shop-hero',
            type: 'hero',
            props: {
              variant: 'split',
              eyebrow: 'Made slowly. Worn often.',
              heading: 'Everyday objects with uncommon character',
              body: 'A considered collection of lasting essentials, made from honest materials by people who know their craft.',
              trustLine: 'Responsible materials · Small-batch production · Easy returns',
              align: 'start',
              tone: 'light',
              spacing: 'lg',
              width: 'wide',
            },
            slots: { actions: ['shop-primary', 'shop-secondary'], media: ['shop-image'] },
          },
          'shop-primary': {
            id: 'shop-primary',
            type: 'cta',
            props: {
              label: 'Shop new arrivals',
              href: '#collection',
              emphasis: 'primary',
              size: 'lg',
            },
          },
          'shop-secondary': {
            id: 'shop-secondary',
            type: 'cta',
            props: { label: 'Our materials', href: '#materials', emphasis: 'link', size: 'lg' },
          },
          'shop-image': {
            id: 'shop-image',
            type: 'image',
            props: {
              src: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=85',
              alt: 'A warm, carefully arranged independent design store.',
              fit: 'cover',
              ratio: 'square',
              radius: 'md',
              width: 'full',
              align: 'center',
            },
          },
          'shop-products': {
            id: 'shop-products',
            type: 'productGrid',
            props: {
              eyebrow: 'The studio collection',
              heading: 'Everyday objects, considered properly',
              body: 'Quiet materials, useful proportions, and the details that make daily rituals feel better.',
              actionLabel: 'Shop product',
              showRatings: true,
              variant: 'featured',
              columns: '3',
              imageRatio: 'square',
              products: [
                {
                  name: 'Arc task lamp',
                  description:
                    'Warm, focused light with a weighted base and three considered brightness levels.',
                  price: '$189',
                  imageSrc:
                    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1600&q=80',
                  imageAlt: 'Matte Arc task lamp on an oak writing desk',
                  badge: 'Bestseller',
                  href: '#product-arc-lamp',
                  rating: 4.9,
                  reviewCount: 128,
                  featured: true,
                },
                {
                  name: 'Fold catchall tray',
                  description:
                    'Vegetable-tanned leather shaped for the small things worth keeping close.',
                  price: '$64',
                  originalPrice: '$79',
                  badge: 'Limited',
                  href: '#product-fold-tray',
                  rating: 4.7,
                  reviewCount: 74,
                },
                {
                  name: 'Still carafe',
                  description: 'Hand-finished glass with a balanced pour and a quiet silhouette.',
                  price: '$92',
                  href: '#product-still-carafe',
                  rating: 4.8,
                  reviewCount: 49,
                },
              ],
            },
          },
          'shop-logos': {
            id: 'shop-logos',
            type: 'logoCloud',
            props: {
              eyebrow: 'Seen in',
              heading: 'Independent design, recognized worldwide',
              variant: 'framed',
              columns: '5',
              items: [
                { name: 'Monocle' },
                { name: 'Kinfolk' },
                { name: 'Dezeen' },
                { name: 'Wallpaper*' },
                { name: 'Frame' },
              ],
            },
          },
          'shop-features': {
            id: 'shop-features',
            type: 'features',
            props: {
              eyebrow: 'The standard behind every piece',
              heading: 'Better materials make better everyday rituals',
              body: 'We choose every detail for longevity, repairability, and a quieter footprint.',
              variant: 'bordered',
              columns: '3',
              items: [
                {
                  icon: '01',
                  kicker: 'Materials',
                  title: 'Naturally durable',
                  body: 'Traceable fibers and solid materials that improve with use.',
                },
                {
                  icon: '02',
                  kicker: 'Making',
                  title: 'Crafted in small runs',
                  body: 'Close partnerships protect quality and reduce unnecessary waste.',
                },
                {
                  icon: '03',
                  kicker: 'Care',
                  title: 'Designed to stay',
                  body: 'Simple care guidance and repair support extend the life of every piece.',
                },
              ],
            },
          },
          'shop-content': {
            id: 'shop-content',
            type: 'content-section',
            props: {
              eyebrow: 'The material story',
              heading: 'Fewer things. Better considered.',
              body: 'We work with workshops that understand the material from the inside out. That knowledge shows up in the weight, the finish, and how the object ages.',
              layout: 'editorial',
              highlights: [
                { title: 'Traceable sources', body: 'Every core material has a clear origin.' },
                {
                  title: 'Low-impact finishes',
                  body: 'Surface treatments chosen for people and place.',
                },
                {
                  title: 'Repair first',
                  body: 'Components designed to be maintained, not discarded.',
                },
              ],
              link: { label: 'Read our sourcing standard', href: '#materials' },
            },
          },
          'shop-stats': {
            id: 'shop-stats',
            type: 'stats',
            props: {
              eyebrow: 'A lighter footprint',
              heading: 'Progress written in the details',
              variant: 'cards',
              items: [
                {
                  value: '86%',
                  label: 'Preferred materials',
                  detail: 'Recycled, regenerative, or responsibly sourced',
                },
                {
                  value: '41%',
                  label: 'Lower packaging weight',
                  detail: 'Compared with our first collection',
                },
                {
                  value: '12',
                  label: 'Long-term workshops',
                  detail: 'Relationships built over years',
                },
                { value: '2.8×', label: 'Longer kept', detail: 'Reported by returning customers' },
              ],
            },
          },
          'shop-quotes': {
            id: 'shop-quotes',
            type: 'testimonials',
            props: {
              eyebrow: 'At home with you',
              heading: 'Pieces people live with, not around',
              variant: 'cards',
              columns: '3',
              items: [
                {
                  quote: 'The finish has become more beautiful with every month of use.',
                  author: 'Ari',
                  role: 'Verified customer',
                  rating: 5,
                },
                {
                  quote:
                    'It is rare to find something this useful that also feels this considered.',
                  author: 'Mina',
                  role: 'Verified customer',
                  rating: 5,
                },
                {
                  quote:
                    'The packaging, material, and service all felt part of the same thoughtful idea.',
                  author: 'Sam',
                  role: 'Verified customer',
                  rating: 5,
                },
              ],
            },
          },
          'shop-comparison': {
            id: 'shop-comparison',
            type: 'comparisonTable',
            props: {
              eyebrow: 'Find your finish',
              heading: 'Three materials, one lasting standard',
              featureLabel: 'Details',
              plans: [
                {
                  name: 'Natural',
                  description: 'Warm and tactile',
                  price: 'From $84',
                  actionLabel: 'Shop natural',
                  actionHref: '#natural',
                },
                {
                  name: 'Smoked',
                  description: 'Deep and architectural',
                  price: 'From $96',
                  badge: 'Signature',
                  actionLabel: 'Shop smoked',
                  actionHref: '#smoked',
                  featured: true,
                },
                {
                  name: 'Mineral',
                  description: 'Quiet and resilient',
                  price: 'From $92',
                  actionLabel: 'Shop mineral',
                  actionHref: '#mineral',
                },
              ],
              rows: [
                { feature: 'Finish', values: ['Hand-oiled', 'Low-smoke oil', 'Mineral wash'] },
                {
                  feature: 'Character',
                  values: ['Warm grain', 'Deep contrast', 'Soft variation'],
                  highlight: true,
                },
                { feature: 'Care', values: ['Annual oil', 'Occasional oil', 'Wipe clean'] },
              ],
            },
          },
          'shop-faq': {
            id: 'shop-faq',
            type: 'faq',
            props: {
              eyebrow: 'Good to know',
              heading: 'Care, delivery, and returns',
              layout: 'columns',
              variant: 'divided',
              items: [
                {
                  question: 'How quickly will my order ship?',
                  answer:
                    'In-stock pieces leave our studio within two business days. Made-to-order dates appear on each product page.',
                },
                {
                  question: 'Can I return a piece after opening it?',
                  answer:
                    'Yes. Try it at home and return it in resalable condition within 30 days.',
                },
                {
                  question: 'Do you ship internationally?',
                  answer:
                    'We deliver to most regions. Duties and estimated delivery appear before checkout.',
                },
                {
                  question: 'How should I care for natural finishes?',
                  answer:
                    'Use a soft damp cloth for daily care. Each order includes material-specific guidance.',
                },
              ],
            },
          },
          'shop-promo': {
            id: 'shop-promo',
            type: 'promoBanner',
            props: {
              label: 'A considered welcome',
              headline: 'Make the first order feel like the start of something lasting',
              body: 'Join the studio list for early access, material stories, and complimentary delivery on your first order.',
              actions: [
                { label: 'Explore the collection', href: '#collection', emphasis: 'primary' },
                { label: 'Read our material standard', href: '#materials', emphasis: 'secondary' },
              ],
              imageSrc:
                'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80',
              imageAlt: 'A warm independent design store arranged with care',
              showMedia: true,
              variant: 'split',
              panelStyle: 'inverse',
              mediaPosition: 'end',
              mediaAspect: 'wide',
              padding: 'spacious',
              radius: 'xl',
              align: 'start',
            },
          },
          'shop-newsletter': {
            id: 'shop-newsletter',
            type: 'newsletter',
            props: {
              eyebrow: 'Notes from the studio',
              heading: 'New objects, material stories, and useful care',
              body: 'A considered letter, sent when there is something worth sharing.',
              buttonLabel: 'Join the list',
              privacy: 'No weekly pressure. Leave whenever you like.',
              variant: 'card',
              action: '/subscribe',
            },
          },
        },
      },
      {
        id: 'professional-services',
        name: 'Professional services',
        version: 1,
        surfaces: ['site'],
        rootId: 'services-root',
        nodes: {
          'services-root': {
            id: 'services-root',
            type: 'stack',
            props: { direction: 'column', gap: 'none', width: 'full' },
            slots: {
              default: [
                'services-hero',
                'services-logos',
                'services-content',
                'services-process',
                'services-stats',
                'services-team',
                'services-quotes',
                'services-faq',
                'services-contact',
              ],
            },
          },
          'services-hero': {
            id: 'services-hero',
            type: 'hero',
            props: {
              variant: 'centered',
              eyebrow: 'Strategy for consequential decisions',
              heading: 'Move through complexity with a clear point of view',
              body: 'We help leadership teams align, choose, and act when the stakes are high and the path is not obvious.',
              trustLine: 'Independent advice · Senior team · Confidential by default',
              align: 'center',
              tone: 'dark',
              spacing: 'lg',
              width: 'wide',
            },
            slots: { actions: ['services-primary', 'services-secondary'] },
          },
          'services-primary': {
            id: 'services-primary',
            type: 'cta',
            props: {
              label: 'Discuss your challenge',
              href: '#contact',
              emphasis: 'primary',
              size: 'lg',
            },
          },
          'services-secondary': {
            id: 'services-secondary',
            type: 'cta',
            props: { label: 'See how we work', href: '#approach', emphasis: 'ghost', size: 'lg' },
          },
          'services-logos': {
            id: 'services-logos',
            type: 'logoCloud',
            props: {
              eyebrow: 'Trusted when it matters',
              heading: 'Advising leadership across growth, change, and transformation',
              variant: 'minimal',
              items: [
                { name: 'Aperture', descriptor: 'Healthcare' },
                { name: 'Fieldwork', descriptor: 'Infrastructure' },
                { name: 'Harbor', descriptor: 'Financial services' },
                { name: 'Orchard', descriptor: 'Consumer' },
                { name: 'Relay', descriptor: 'Technology' },
                { name: 'Vantage', descriptor: 'Public sector' },
              ],
            },
          },
          'services-content': {
            id: 'services-content',
            type: 'content-section',
            props: {
              eyebrow: 'Our role',
              heading: 'Clarity is a practical advantage',
              body: 'A hard decision rarely needs more noise. It needs the right evidence, a shared frame, and a disciplined way to move from debate to action.',
              layout: 'split',
              highlights: [
                {
                  title: 'Corporate strategy',
                  body: 'Make the few choices that concentrate effort and create advantage.',
                },
                {
                  title: 'Operating model',
                  body: 'Align structure, governance, and capability behind the strategy.',
                },
                {
                  title: 'Transformation',
                  body: 'Turn ambition into a sequenced program people can actually deliver.',
                },
                {
                  title: 'Leadership alignment',
                  body: 'Create the shared language required for decisive execution.',
                },
              ],
              link: { label: 'Explore our capabilities', href: '#capabilities' },
            },
          },
          'services-process': {
            id: 'services-process',
            type: 'processSteps',
            props: {
              eyebrow: 'A disciplined engagement',
              heading: 'Evidence, alignment, action',
              body: 'Each stage creates a concrete decision and leaves the organization stronger than we found it.',
              variant: 'minimal',
              layout: 'horizontal',
              steps: [
                {
                  meta: 'Frame',
                  title: 'Define the decision',
                  body: 'Clarify the outcome, the constraints, and what must be true to move.',
                },
                {
                  meta: 'Learn',
                  title: 'Build the evidence',
                  body: 'Combine internal knowledge, market insight, and direct customer truth.',
                },
                {
                  meta: 'Choose',
                  title: 'Make trade-offs explicit',
                  body: 'Turn options into a coherent direction the leadership team owns.',
                },
                {
                  meta: 'Mobilize',
                  title: 'Translate choice into action',
                  body: 'Sequence priorities, ownership, and the measures that will guide delivery.',
                },
              ],
            },
          },
          'services-stats': {
            id: 'services-stats',
            type: 'stats',
            props: {
              eyebrow: 'Selected impact',
              heading: 'Outcomes that continue after the engagement',
              variant: 'contrast',
              items: [
                {
                  value: '18%',
                  label: 'Margin improvement',
                  detail: 'Following portfolio and operating-model reset',
                },
                {
                  value: '6 wk',
                  label: 'To aligned strategy',
                  detail: 'From fragmented priorities to one direction',
                },
                { value: '31%', label: 'Faster decisions', detail: 'After governance redesign' },
                { value: '4.8×', label: 'Program value', detail: 'Measured over two years' },
              ],
            },
          },
          'services-team': {
            id: 'services-team',
            type: 'team',
            props: {
              eyebrow: 'Your senior team',
              heading: 'Experience stays in the room',
              body: 'Every engagement is led and delivered by people who have carried comparable decisions themselves.',
              variant: 'compact',
              columns: '4',
              members: [
                {
                  name: 'Amal Rahman',
                  role: 'Managing Partner',
                  bio: 'Enterprise strategy and leadership alignment.',
                },
                {
                  name: 'Thomas Reed',
                  role: 'Partner',
                  bio: 'Operating models and complex transformation.',
                },
                {
                  name: 'Sara Lin',
                  role: 'Partner',
                  bio: 'Growth strategy and customer-led innovation.',
                },
                {
                  name: 'Daniel Okafor',
                  role: 'Principal',
                  bio: 'Analytics, portfolio choices, and execution.',
                },
              ],
            },
          },
          'services-quotes': {
            id: 'services-quotes',
            type: 'testimonials',
            props: {
              eyebrow: 'What leaders say',
              heading: 'A partner for the decision, not the theatre around it',
              variant: 'spotlight',
              columns: '2',
              items: [
                {
                  quote:
                    'They gave our leadership team the evidence and language to make a choice we had delayed for a year.',
                  author: 'Helen Morris',
                  role: 'Chief Executive',
                  company: 'Aperture',
                  rating: 5,
                },
                {
                  quote:
                    'The recommendation was sharp, but the real value was how they helped us own it together.',
                  author: 'Karim Nasser',
                  role: 'COO',
                  company: 'Harbor',
                  rating: 5,
                },
              ],
            },
          },
          'services-faq': {
            id: 'services-faq',
            type: 'faq',
            props: {
              eyebrow: 'Working together',
              heading: 'What to expect from an engagement',
              variant: 'cards',
              layout: 'columns',
              openFirst: true,
              items: [
                {
                  question: 'How large is the project team?',
                  answer:
                    'Most engagements are led by a partner with two to four senior practitioners, scaled only when the work requires it.',
                },
                {
                  question: 'Do you work with internal strategy teams?',
                  answer:
                    'Yes. We design the engagement to strengthen internal capability, not replace it.',
                },
                {
                  question: 'Can you support implementation?',
                  answer:
                    'We stay through mobilization and the critical early decisions, with a clear transition into internal ownership.',
                },
                {
                  question: 'How do you handle confidential work?',
                  answer:
                    'Confidentiality is built into access, research, collaboration, and communication from the first conversation.',
                },
              ],
            },
          },
          'services-contact': {
            id: 'services-contact',
            type: 'formSection',
            props: {
              eyebrow: 'A confidential first conversation',
              heading: 'Start with the decision in front of you',
              body: 'Tell us what has changed, what is at stake, and where alignment is breaking down. A partner will respond directly.',
              fields: [
                {
                  id: 'name',
                  name: 'name',
                  type: 'text',
                  label: 'Name',
                  autoComplete: 'name',
                  required: true,
                  width: 'half',
                },
                {
                  id: 'email',
                  name: 'email',
                  type: 'email',
                  label: 'Work email',
                  autoComplete: 'email',
                  required: true,
                  width: 'half',
                },
                {
                  id: 'challenge',
                  name: 'challenge',
                  type: 'textarea',
                  label: 'What decision is in front of you?',
                  helper: 'A concise description of the context and stakes is enough.',
                  required: true,
                  width: 'full',
                  rows: 6,
                },
                {
                  id: 'confidentiality',
                  name: 'confidentiality',
                  type: 'checkbox',
                  label: 'I understand this message will be handled confidentially.',
                  required: true,
                  width: 'full',
                },
              ],
              submitLabel: 'Request a conversation',
              footerNote: 'Your message goes directly to a partner.',
              successHint: 'A partner typically responds within two business days.',
              action: '/contact',
              method: 'post',
              variant: 'split',
            },
          },
        },
      },
    ],
  },
};
