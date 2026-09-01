import type { JsonValue } from '@craftkit/builder-schema';

export const carouselExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'premium product story carousel with split media',
    node: {
      type: 'carousel',
      props: {
        eyebrow: 'Inside the platform',
        heading: 'See how focused teams move from idea to outcome',
        body: 'Three practical workflows, presented without hiding the details.',
        variant: 'split',
        mediaPosition: 'start',
        mediaAspect: 'square',
        autoplay: false,
        showControls: true,
        showIndicators: true,
        loop: true,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            label: '01 · Plan',
            title: 'Turn a rough brief into an executable plan',
            body: 'Map the real constraints, owners, and proof points before work begins.',
            imageSrc:
              'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'Team reviewing a project plan around a table',
            action: { label: 'Explore planning', href: '/product/planning' },
          },
          {
            label: '02 · Build',
            title: 'Keep decisions close to the work',
            body: 'Give every contributor the context they need without adding another status meeting.',
            imageSrc:
              'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'Collaborative team working in a bright studio',
            action: { label: 'See team workflows', href: '/product/workflows' },
          },
          {
            label: '03 · Learn',
            title: 'Measure what changed, not what shipped',
            body: 'Connect delivery to outcomes so each cycle begins with better evidence.',
            imageSrc:
              'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'Analytics dashboard displayed on a laptop',
            action: { label: 'View analytics', href: '/product/analytics' },
          },
        ],
      },
    },
  },
  {
    prompt: 'عارض شرائح عربي لوجهات سفر فاخرة',
    node: {
      type: 'carousel',
      props: {
        eyebrow: 'رحلات مختارة',
        heading: 'أماكن تستحق أن تأخذ وقتك',
        body: 'وجهات هادئة وتجارب مصممة بعناية، من الوصول حتى آخر صباح.',
        variant: 'media',
        mediaAspect: 'wide',
        autoplay: false,
        showControls: true,
        showIndicators: true,
        controlsLabel: 'أدوات عارض الرحلات',
        previousLabel: 'الشريحة السابقة',
        nextLabel: 'الشريحة التالية',
        playLabel: 'تشغيل العارض',
        pauseLabel: 'إيقاف العارض',
        goToLabel: 'انتقل إلى الشريحة',
        align: 'start',
        tone: 'dark',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            label: 'صحراء وهدوء',
            title: 'ليلتان تحت سماء وادي رم',
            body: 'مخيم صغير، دليل محلي، ومسار يبتعد عن الطرق المعتادة.',
            imageSrc:
              'https://images.unsplash.com/photo-1568801556940-e5b3a55fa6ea?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'تكوينات صخرية في وادي صحراوي عند الغروب',
            action: { label: 'اكتشف الرحلة', href: '/journeys/wadi-rum' },
          },
          {
            label: 'بحر ومدينة',
            title: 'عكا على مهل',
            body: 'ثلاثة أيام بين الميناء والأسواق والمطابخ التي تحفظ حكاية المكان.',
            imageSrc:
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'شاطئ هادئ ومياه زرقاء صافية',
            action: { label: 'شاهد البرنامج', href: '/journeys/akka' },
          },
        ],
      },
    },
  },
];
