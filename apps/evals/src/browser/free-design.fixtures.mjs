// Hand-authored answers for the local scripted-provider proof; not a model-quality benchmark.
const el = (tag, text = '', className = '', children = [], attributes = {}) => ({
  kind: 'element',
  tag,
  ...(text ? { text } : {}),
  ...(className ? { className } : {}),
  ...(Object.keys(attributes).length ? { attributes } : {}),
  children,
});
const p = (text, className = '') => el('p', text, className);
const h = (tag, text, className = '') => el(tag, text, className);
const div = (className, children, attributes) => el('div', '', className, children, attributes);
const commonCss = `.ck-fd{box-sizing:border-box;color:var(--ck-ink);background:var(--ck-bg);font-family:var(--ck-font-body);line-height:1.6;padding:clamp(24px,5vw,72px);min-height:100vh}.ck-fd *{box-sizing:border-box;min-width:0}.ck-fd h1,.ck-fd h2,.ck-fd h3,.ck-fd p{margin:0}.ck-fd h1,.ck-fd h2,.ck-fd h3{line-height:1.15}.ck-fd h1{font-size:clamp(36px,6vw,80px);letter-spacing:-.045em}.ck-fd h2{font-size:clamp(24px,3vw,36px)}.ck-fd p{max-width:65ch}.ck-fd a{color:inherit;text-underline-offset:5px}.ck-fd .ck-fd-eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}.ck-fd .ck-fd-muted{color:var(--ck-muted)}.ck-fd .ck-fd-line{border-top:1px solid var(--ck-border);padding-top:20px}.ck-fd :focus-visible{outline:3px solid var(--ck-accent);outline-offset:5px}@media(max-width:600px){.ck-fd{padding:24px}.ck-fd h1{letter-spacing:-.025em}}`;

function resume(ar) {
  const copy = ar
    ? {
        heading: 'ليان منصور',
        role: 'مصممة تجربة مستخدم ومنتجات رقمية',
        intro:
          'أحوّل المسائل المعقّدة إلى تجارب واضحة. أجمع البحث والتفكير البصري لبناء منتجات يفهمها الناس ويثقون بها.',
        label: 'سيرة مهنية · بيانات توضيحية',
        location: 'عمّان، الأردن · متاحة للعمل عن بعد',
        experience: 'خبرات مختارة',
        job: 'مصممة منتجات · استوديو مدار',
        jobBody:
          'تصميم رحلات المستخدم من الاكتشاف إلى النماذج الأولية، بالتعاون مع فرق المنتج والهندسة.',
        project: 'مشروع مختار',
        projectTitle: 'دليل المدينة للجميع',
        projectBody:
          'مفهوم بحثي لاستكشاف الأماكن العامة من خلال احتياجات الوصول، مع خرائط واضحة وتفاصيل عملية.',
        skills: 'مجالات العمل',
        skillList: ['بحث المستخدم', 'تصميم التفاعل', 'نظم التصميم', 'إتاحة الاستخدام'],
        approach: 'منهجي في العمل',
        approachText:
          'أبدأ بالسؤال المناسب، أختبر الافتراضات مبكرًا، وأعتني بالتفاصيل التي تجعل التجربة أبسط.',
        note: 'الأسماء والخبرات هنا أمثلة توضيحية، وليست بيانات مستخدم حقيقية.',
        contact: 'التواصل',
        email: 'layan@example.test',
      }
    : {
        heading: 'Layan Mansour',
        role: 'Product & experience designer',
        intro:
          'I turn complex problems into clear experiences. Research and visual thinking come together in products people understand and trust.',
        label: 'Professional profile · illustrative content',
        location: 'Amman, Jordan · Open to remote work',
        experience: 'Selected experience',
        job: 'Product designer · Madar Studio',
        jobBody:
          'Designed journeys from discovery through prototyping, partnering closely with product and engineering teams.',
        project: 'Selected project',
        projectTitle: 'A city guide for everyone',
        projectBody:
          'A research concept for exploring public places through access needs, with clear maps and practical details.',
        skills: 'Practice areas',
        skillList: ['User research', 'Interaction design', 'Design systems', 'Accessibility'],
        approach: 'How I work',
        approachText:
          'Ask the useful question. Test the uncertain assumption. Care about the details that make an experience easier.',
        note: 'Names and experience are illustrative examples, not real user credentials.',
        contact: 'Contact',
        email: 'layan@example.test',
      };
  return {
    title: copy.heading,
    kind: 'resume',
    label: copy.label,
    concept:
      'A quiet, print-friendly professional document: narrow identity rail beside a spacious evidence-led chronology, with no marketing chrome.',
    layout:
      'An identity sidebar and a broad experience column; stack sidebar first on small screens and preserve logical RTL order.',
    tree: {
      kind: 'root',
      children: [
        el(
          'section',
          '',
          'ck-fd ck-fd-resume',
          [
            p(copy.label, 'ck-fd-eyebrow ck-fd-muted'),
            div('ck-fd-resume-grid', [
              el('aside', '', 'ck-fd-resume-identity', [
                div('ck-fd-monogram', [p(ar ? 'ل م' : 'LM')], { 'aria-hidden': 'true' }),
                h('h1', copy.heading),
                p(copy.role, 'ck-fd-role'),
                p(copy.location, 'ck-fd-muted'),
                el('a', copy.email, '', [], { href: `mailto:${copy.email}` }),
                div('ck-fd-line', [
                  h('h2', copy.skills),
                  el(
                    'ul',
                    '',
                    'ck-fd-skills',
                    copy.skillList.map((v) => el('li', v)),
                  ),
                ]),
              ]),
              div('ck-fd-resume-content', [
                p(copy.intro, 'ck-fd-resume-intro'),
                div('ck-fd-line', [
                  p(copy.experience, 'ck-fd-eyebrow ck-fd-muted'),
                  h('h2', copy.job),
                  p(copy.jobBody),
                ]),
                div('ck-fd-line', [
                  p(copy.project, 'ck-fd-eyebrow ck-fd-muted'),
                  h('h2', copy.projectTitle),
                  p(copy.projectBody),
                ]),
                div('ck-fd-line', [h('h2', copy.approach), p(copy.approachText)]),
                p(copy.note, 'ck-fd-note ck-fd-muted'),
              ]),
            ]),
          ],
          { id: 'composition' },
        ),
      ],
    },
    css: `${commonCss}.ck-fd-resume{max-width:1180px;margin-inline:auto}.ck-fd-resume-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:clamp(32px,6vw,88px);margin-top:44px}.ck-fd-resume-identity{display:flex;flex-direction:column;gap:20px}.ck-fd-resume h1{font-size:clamp(36px,4vw,56px)}.ck-fd-monogram{width:68px;height:68px;display:grid;place-items:center;background:var(--ck-accent);color:var(--ck-on-accent);font-weight:600;font-size:24px}.ck-fd-role{font-size:19px}.ck-fd-skills{padding-inline-start:20px;line-height:2}.ck-fd-resume-content{display:flex;flex-direction:column;gap:34px}.ck-fd-resume-content .ck-fd-line{display:grid;gap:14px}.ck-fd-resume-intro{font-size:24px;line-height:1.45}.ck-fd-note{font-size:12px}.ck-fd-resume-identity h2{font-size:18px}@media(max-width:650px){.ck-fd-resume-grid{grid-template-columns:1fr;gap:36px}.ck-fd-resume-intro{font-size:21px}.ck-fd-resume-identity{gap:14px}}@media print{.ck-fd-resume{padding:0;min-height:0}.ck-fd-resume-grid{grid-template-columns:1fr 2fr;gap:28px}.ck-fd-line{break-inside:avoid}}`,
    grid: '.ck-fd-resume-grid',
    desktopColumns: 2,
  };
}

function editorial(ar) {
  const copy = ar
    ? {
        heading: 'المكان الذي يصنعنا',
        masthead: 'دفتر المدينة',
        issue: 'عمارة · ثقافة · حياة يومية',
        lead: 'كيف تتحوّل الساحات الصغيرة إلى ذاكرة مشتركة؟ جولة بين الظل والحجر والأماكن التي تجمعنا.',
        side: 'في هذا العدد',
        topics: ['المشي كطريقة للفهم', 'حديقة عند نهاية الشارع', 'ما الذي يبقى من البيوت؟'],
        kicker: 'مقالة افتتاحية',
        quote: 'المدينة الجيدة تمنحنا سببًا للتوقّف، لا طريقًا للعبور فقط.',
        body: 'يبدأ فهم الحي من إيقاع الحياة فيه: باب يُفتح، مقعد ينتظر عابرًا، وشجرة تمنح الظل. تلك التفاصيل المتواضعة هي التي تجعل المكان قابلًا للسكن والتذكّر.',
        more: 'من الميدان',
        bottom: 'ملاحظات من نزهة بطيئة',
        note: 'مقالة توضيحية لتجربة التصميم التحريري.',
      }
    : {
        heading: 'The places that shape us',
        masthead: 'CITY NOTEBOOK',
        issue: 'Architecture · Culture · Everyday life',
        lead: 'How do small public spaces become shared memories? A walk through shade, stone, and the places that bring us together.',
        side: 'In this edition',
        topics: [
          'Walking as a way of knowing',
          'A garden at the end of the street',
          'What remains of a home?',
        ],
        kicker: 'The opening essay',
        quote: 'A good city gives us a reason to pause, not just a route to pass through.',
        body: 'To understand a neighborhood, notice the rhythm of life within it: a door opening, a bench waiting for a passerby, a tree offering shade. These modest details make a place worth inhabiting and remembering.',
        more: 'Field notes',
        bottom: 'Observations from a slow walk',
        note: 'An illustrative essay for the editorial design proof.',
      };
  return {
    title: copy.heading,
    kind: 'website',
    label: copy.masthead,
    concept:
      'An independent architecture journal: ruled masthead, offset oversized headline, abstract architectural plate and a narrow reading-index rail.',
    layout:
      'Three uneven editorial columns around a spanning headline; index, illustrated plate and essay transform to a single reading column on phones.',
    tree: {
      kind: 'root',
      children: [
        el(
          'article',
          '',
          'ck-fd ck-fd-editorial',
          [
            div('ck-fd-masthead', [p(copy.masthead), p(copy.issue, 'ck-fd-eyebrow')]),
            div('ck-fd-editorial-grid', [
              el('aside', '', 'ck-fd-index', [
                h('h2', copy.side),
                ...copy.topics.map((v) => p(v, 'ck-fd-line')),
              ]),
              div('ck-fd-editorial-head', [
                p(copy.kicker, 'ck-fd-eyebrow'),
                h('h1', copy.heading),
                p(copy.lead, 'ck-fd-lead'),
              ]),
              div('ck-fd-plate', [div('ck-fd-building', []), div('ck-fd-sun', [])], {
                role: 'img',
                'aria-label': ar
                  ? 'رسم تجريدي لقوس معماري وشمس'
                  : 'An abstract architectural arch and sun',
              }),
              div('ck-fd-essay', [
                el('blockquote', copy.quote, 'ck-fd-quote'),
                p(copy.body),
                p(copy.note, 'ck-fd-muted ck-fd-note'),
              ]),
            ]),
            div('ck-fd-journal-bottom', [p(copy.more, 'ck-fd-eyebrow'), h('h2', copy.bottom)]),
          ],
          { id: 'composition' },
        ),
      ],
    },
    css: `${commonCss}.ck-fd-editorial{max-width:1440px;margin-inline:auto}.ck-fd-masthead{display:flex;justify-content:space-between;gap:20px;align-items:center;border-block:2px solid var(--ck-ink);padding-block:18px;font-weight:600}.ck-fd-editorial-grid{display:grid;grid-template-columns:minmax(0,.65fr) minmax(0,1.4fr) minmax(0,1fr);gap:36px;padding-top:40px}.ck-fd-index{grid-row:1 / 3;display:flex;flex-direction:column;gap:24px;padding-top:10px}.ck-fd-index h2{font-size:16px}.ck-fd-index p{font-size:14px}.ck-fd-editorial-head{grid-column:2 / 4;display:grid;gap:24px}.ck-fd-editorial h1{max-width:13ch;font-family:serif;font-weight:400;font-size:clamp(42px,7vw,92px)}.ck-fd-lead{font-size:20px;max-width:45ch}.ck-fd-plate{position:relative;min-height:330px;background:var(--ck-accent);overflow:hidden}.ck-fd-building{position:absolute;inset:25% 20% 0;background:var(--ck-surface);border-radius:50% 50% 0 0}.ck-fd-building:after{content:'';position:absolute;inset:25% 25% 0;background:var(--ck-ink);border-radius:50% 50% 0 0}.ck-fd-sun{position:absolute;width:60px;height:60px;top:10%;inset-inline-end:10%;border:1px solid var(--ck-on-accent);border-radius:50%}.ck-fd-essay{display:flex;flex-direction:column;gap:24px}.ck-fd-quote{font-family:serif;font-size:26px;line-height:1.25;margin:0}.ck-fd-note{font-size:12px}.ck-fd-journal-bottom{display:flex;justify-content:space-between;gap:24px;margin-top:40px;padding-block:24px;border-top:2px solid var(--ck-ink)}@media(max-width:700px){.ck-fd-editorial-grid{grid-template-columns:1fr;gap:28px}.ck-fd-index{grid-row:auto;order:4}.ck-fd-editorial-head{grid-column:auto}.ck-fd-masthead,.ck-fd-journal-bottom{flex-direction:column;align-items:flex-start}.ck-fd-editorial h1{font-size:48px}.ck-fd-plate{min-height:280px}}`,
    grid: '.ck-fd-editorial-grid',
    desktopColumns: 3,
  };
}

function portfolio(ar) {
  const copy = ar
    ? {
        heading: 'أفكار واضحة. أثر يبقى.',
        identity: 'نور · استوديو مستقل',
        intro:
          'أصمّم هويات وتجارب رقمية تجمع الجرأة بالوضوح. هنا مجموعة مختارة من مشروعات توضيحية.',
        action: 'بدّل طريقة العرض',
        view: 'العرض الواسع',
        compact: 'العرض المتراص',
        projects: ['أطلس — هوية ثقافية', 'نواة — تجربة تعليمية', 'مدى — منصة إبداعية'],
        types: ['نظام هوية بصرية', 'تصميم منتج رقمي', 'استراتيجية وتجربة'],
        note: 'الأعمال المعروضة أمثلة تصميم توضيحية.',
        contact: 'لنبنِ فكرة تستحق الظهور.',
      }
    : {
        heading: 'Clear ideas. Lasting impact.',
        identity: 'NOUR / INDEPENDENT STUDIO',
        intro:
          'Identity and digital experiences with equal parts character and clarity. A selection of illustrative design projects.',
        action: 'Change project layout',
        view: 'Expansive view',
        compact: 'Compact view',
        projects: [
          'Atlas — a cultural identity',
          'Nawa — learning reimagined',
          'Mada — a creative platform',
        ],
        types: ['Visual identity system', 'Digital product design', 'Strategy & experience'],
        note: 'The projects shown are illustrative design examples.',
        contact: 'Let’s make an idea worth seeing.',
      };
  return {
    title: copy.heading,
    kind: 'portfolio',
    label: copy.identity,
    concept:
      'A graphic independent studio portfolio: oversized left-aligned manifesto above uneven project plates; a real JavaScript control changes spatial density.',
    layout:
      'A wide manifesto, offset introduction and three project plates with unequal widths; preserve semantic order and stack every plate on phones.',
    tree: {
      kind: 'root',
      children: [
        el(
          'section',
          '',
          'ck-fd ck-fd-portfolio',
          [
            p(copy.identity, 'ck-fd-eyebrow'),
            div('ck-fd-manifesto', [h('h1', copy.heading), p(copy.intro, 'ck-fd-muted')]),
            div('ck-fd-tools', [
              p(copy.view, 'ck-fd-eyebrow'),
              el('button', copy.action, 'ck-fd-toggle', [], {
                type: 'button',
                'aria-pressed': 'false',
              }),
            ]),
            div(
              'ck-fd-projects',
              copy.projects.map((title, i) =>
                el('article', '', `ck-fd-project ck-fd-project-${i}`, [
                  div('ck-fd-project-art', [p(['Aa', '↗', 'M'][i], 'ck-fd-art-letter')], {
                    'aria-hidden': 'true',
                  }),
                  p(copy.types[i], 'ck-fd-eyebrow'),
                  h('h2', title),
                ]),
              ),
            ),
            div('ck-fd-portfolio-bottom', [h('h2', copy.contact), p(copy.note, 'ck-fd-muted')]),
          ],
          { id: 'composition' },
        ),
      ],
    },
    css: `${commonCss}.ck-fd-portfolio{max-width:1600px;margin-inline:auto}.ck-fd-manifesto{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:50px;align-items:end;margin-block:60px}.ck-fd-manifesto h1{max-width:10ch;font-size:clamp(48px,8vw,112px)}.ck-fd-manifesto p{font-size:20px;max-width:34ch}.ck-fd-tools{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}.ck-fd-toggle{font:inherit;padding:12px 18px;background:var(--ck-surface);color:var(--ck-ink);border:1px solid var(--ck-border);cursor:pointer}.ck-fd-projects{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,.8fr);gap:24px;align-items:start}.ck-fd-project{display:grid;gap:14px}.ck-fd-project h2{font-size:24px}.ck-fd-project-art{min-height:300px;display:grid;place-items:center;background:var(--ck-accent);color:var(--ck-on-accent)}.ck-fd-project-1{padding-top:60px}.ck-fd-project-1 .ck-fd-project-art{background:var(--ck-ink);color:var(--ck-bg)}.ck-fd-project-2{padding-top:120px}.ck-fd-project-2 .ck-fd-project-art{background:var(--ck-surface);color:var(--ck-ink);border:1px solid var(--ck-border)}.ck-fd-art-letter{font-family:serif;font-size:100px;line-height:1}.ck-fd-projects.ck-fd-compact{grid-template-columns:repeat(3,minmax(0,1fr))}.ck-fd-compact .ck-fd-project{padding-top:0}.ck-fd-compact .ck-fd-project-art{min-height:220px}.ck-fd-portfolio-bottom{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-top:80px;padding-top:28px;border-top:1px solid var(--ck-border)}@media(max-width:700px){.ck-fd-manifesto{grid-template-columns:1fr;gap:24px;margin-block:38px}.ck-fd-projects,.ck-fd-projects.ck-fd-compact{grid-template-columns:1fr}.ck-fd-project-1,.ck-fd-project-2{padding-top:0}.ck-fd-tools,.ck-fd-portfolio-bottom{align-items:flex-start;flex-direction:column}.ck-fd-project-art{min-height:260px}}`,
    js: `const button=ck.root.querySelector('.ck-fd-toggle');const grid=ck.root.querySelector('.ck-fd-projects');const label=ck.root.querySelector('.ck-fd-tools p');const toggle=()=>{const compact=grid.classList.toggle('ck-fd-compact');button.setAttribute('aria-pressed',String(compact));label.textContent=compact?${JSON.stringify(copy.compact)}:${JSON.stringify(copy.view)};};button.addEventListener('click',toggle);ck.onDispose(()=>button.removeEventListener('click',toggle));`,
    grid: '.ck-fd-projects',
    desktopColumns: 3,
    action: copy.action,
    compact: copy.compact,
  };
}

export function freeDesignFixture(name, lang = 'en') {
  const ar = lang === 'ar';
  const fixture = { resume, editorial, portfolio }[name](ar);
  const outer = fixture.tree.children[0];
  outer.attributes['aria-labelledby'] = 'composition-title';
  const queue = [...outer.children];
  while (queue.length) {
    const node = queue.shift();
    if (node.tag === 'h1') node.attributes = { ...node.attributes, id: 'composition-title' };
    queue.push(...node.children);
  }
  const font = ar ? 'IBM Plex Sans Arabic' : 'IBM Plex Sans';
  const colors =
    name === 'portfolio'
      ? {
          bg: '#f6f8f3',
          surface: '#e8eddf',
          ink: '#17221b',
          muted: '#4a554d',
          accent: '#235735',
          onAccent: '#ffffff',
          border: '#ccd4c9',
        }
      : name === 'editorial'
        ? {
            bg: '#f7f2e9',
            surface: '#e9dccc',
            ink: '#29251e',
            muted: '#615747',
            accent: '#92513b',
            onAccent: '#ffffff',
            border: '#cbbba5',
          }
        : {
            bg: '#ffffff',
            surface: '#f4f7f8',
            ink: '#162c36',
            muted: '#4e626d',
            accent: '#264f63',
            onAccent: '#ffffff',
            border: '#d5dfe4',
          };
  return {
    ...fixture,
    name,
    lang,
    request: ar
      ? `صمم ${name === 'resume' ? 'سيرة ذاتية' : name === 'portfolio' ? 'بورتفوليو' : 'مجلة معمارية'} بتكوين أصلي. استخدم UI UX Pro Max. البيانات في المثال توضيحية.`
      : `Create an original ${name === 'resume' ? 'professional resume' : name === 'portfolio' ? 'portfolio' : 'architecture magazine'} using UI UX Pro Max. All supplied example content is illustrative.`,
    plan: {
      intent: 'replace',
      locale: { lang, dir: ar ? 'rtl' : 'ltr' },
      title: fixture.title,
      description: fixture.concept.slice(0, 190),
      design: {
        kind: fixture.kind,
        composition: 'bespoke',
        chrome: 'none',
        concept: fixture.concept,
      },
      tokens: {
        ...colors,
        fontDisplay: { family: font, weights: [400, 600] },
        fontBody: { family: font, weights: [400, 600] },
        radius: 'none',
        signature: fixture.layout,
      },
      primaryCta: { label: ar ? 'اقرأ الصفحة' : 'Read the page', href: '#composition' },
      nav: [],
      facts: [],
      sections: [
        {
          key: 'composition',
          role: 'hero',
          title: fixture.title,
          anchorId: 'composition',
          purpose: fixture.concept,
          layout: fixture.layout,
          images: [],
          mustSay: [fixture.title],
        },
      ],
    },
  };
}
