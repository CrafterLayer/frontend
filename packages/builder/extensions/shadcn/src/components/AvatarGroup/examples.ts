import type { JsonValue } from '@craftkit/builder-schema';

export const avatarGroupExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'an overlapping avatar group for the project team',
    node: {
      type: 'avatarGroup',
      props: {
        groupLabel: 'Project team',
        people: [
          { name: 'Maya Chen', imageSrc: '/images/team/maya.jpg', initials: 'MC' },
          { name: 'Omar Haddad', imageSrc: '/images/team/omar.jpg', initials: 'OH' },
          { name: 'Lina Faris', initials: 'LF' },
          { name: 'Sam Rivera', initials: 'SR' },
          { name: 'Noor Ali', initials: 'NA' },
          { name: 'Jon Bell', initials: 'JB' },
        ],
        size: 'medium',
        overlap: 'medium',
        maxVisible: 5,
        overflowLabel: 'More people:',
        shape: 'circle',
        tone: 'accent',
        align: 'start',
      },
    },
  },
  {
    prompt: 'مجموعة صور أعضاء الفريق بالعربية',
    node: {
      type: 'avatarGroup',
      props: {
        groupLabel: 'فريق المشروع',
        people: [
          { name: 'ليان خليل', initials: 'ل خ' },
          { name: 'أمير شاهين', initials: 'أ ش' },
          { name: 'سارة منصور', initials: 'س م' },
          { name: 'نور علي', initials: 'ن ع' },
        ],
        size: 'large',
        overlap: 'subtle',
        maxVisible: 3,
        overflowLabel: 'أشخاص إضافيون:',
        shape: 'rounded',
        tone: 'neutral',
        align: 'start',
      },
    },
  },
  {
    prompt: 'a compact centered customer avatar group',
    node: {
      type: 'avatarGroup',
      props: {
        groupLabel: 'Recent customers',
        people: [{ name: 'Avery Stone' }, { name: 'Jordan Lee' }, { name: 'Riley King' }],
        size: 'small',
        overlap: 'strong',
        maxVisible: 3,
        overflowLabel: 'More customers:',
        shape: 'circle',
        tone: 'inverse',
        align: 'center',
      },
    },
  },
];
