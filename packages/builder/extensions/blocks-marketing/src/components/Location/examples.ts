import type { JsonValue } from '@craftkit/builder-schema';

export const locationExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'موقع المقهى ومواعيد العمل مع زر واتساب',
    node: {
      type: 'location',
      props: {
        heading: 'زورونا',
        body: 'على بعد دقيقتين من محطة المترو.',
        address: 'شارع التحلية، حي السليمانية، الرياض',
        addressLabel: 'العنوان',
        mapsLabel: 'افتح في الخرائط',
        hoursLabel: 'مواعيد العمل',
        hours: [
          { days: 'السبت – الخميس', time: '٧:٠٠ ص – ١٢:٠٠ م' },
          { days: 'الجمعة', time: '٤:٠٠ م – ١:٠٠ ص' },
        ],
        hoursNote: 'نغلق في أول أيام العيد.',
        contactLabel: 'تواصل معنا',
        phone: '+966 11 456 7890',
        phoneLabel: 'اتصل',
        whatsapp: '+966 50 123 4567',
        whatsappLabel: 'اطلب عبر واتساب',
        whatsappMessage: 'مرحبًا، أود الطلب.',
        emailLabel: 'البريد',
        mapTitle: 'خريطة موقع المقهى',
        layout: 'split',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'a dental clinic location section with hours, phone, email and a map',
    node: {
      type: 'location',
      props: {
        eyebrow: 'Find the clinic',
        heading: 'Visit Harbour Dental',
        address: '42 Harbour Road, Suite 3, Portsmouth PO1 2AB',
        latitude: 50.7989,
        longitude: -1.0912,
        embedMap: true,
        mapTitle: 'Map of Harbour Dental',
        hours: [
          { days: 'Monday – Friday', time: '8:30 – 18:00' },
          { days: 'Saturday', time: '9:00 – 13:00' },
          { days: 'Sunday', time: 'Closed' },
        ],
        phone: '+44 23 9200 1234',
        email: 'hello@harbourdental.example',
        layout: 'split',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'a simple store address with opening hours and directions',
    node: {
      type: 'location',
      props: {
        heading: 'Our shop',
        address: '7 Rue des Fleurs, 69002 Lyon',
        hours: [{ days: 'Tuesday – Saturday', time: '10:00 – 19:00' }],
        hoursNote: 'Closed in August.',
        layout: 'stacked',
        width: 'narrow',
      },
    },
  },
];
