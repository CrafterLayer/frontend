import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { teamExamples } from './examples';
import { teamSchema } from './schema';
import { Team } from './Team';

const node: Node = { id: 'team-story', type: 'team', props: {} };
const exampleProps = (index: number) =>
  teamSchema.props.parse((teamExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Team',
  component: Team,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Team>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LeadershipCards: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: /Built by people/i })).toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};

export const ArabicEditorial: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'team-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const EmptyState: Story = {
  args: {
    node: { ...node, id: 'team-empty' },
    props: teamSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...teamSchema.props.parse({
        eyebrow: 'Leadership',
        heading: 'Meet the team.',
        body: 'The people behind the product.',
        members: [
          {
            name: 'Maya Chen',
            role: 'Founder',
            bio: 'Builds the roadmap.',
            imageSrc: '/maya.jpg',
            imageAlt: 'Maya',
            profileHref: '/team/maya',
          },
          { name: 'Omar Haddad', role: 'Engineering', profileHref: '/team/omar' },
        ],
      }),
      partStyles: {
        'member.name': { className: 'text-accent' },
        'member.name@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="member.name"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'members.0.name');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="members"]')).toHaveAttribute(
      'data-ck-bind',
      'members',
    );
  },
};

/*
  Without photos (blocks-polish 2026-10-08): each member gets a 64px initials
  avatar above the name, never a portrait-sized box around one letter.
*/
export const WithoutPhotos: Story = {
  args: {
    node: { ...node, id: 'team-avatars' },
    props: teamSchema.props.parse({
      heading: 'The people you will work with',
      columns: '3',
      members: [
        { name: 'Amal Rahman', role: 'Managing partner', bio: 'Leads strategy and delivery.' },
        { name: 'Thomas Reed', role: 'Partner', bio: 'Operating models and transformation.' },
        { name: 'Sara Lin', role: 'Principal', bio: 'Growth strategy and customer insight.' },
      ],
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll('[data-team-avatar]');
    await expect(avatars).toHaveLength(3);
    await expect(avatars[0]).toHaveTextContent('AR');
    await expect((avatars[0] as HTMLElement).getBoundingClientRect().height).toBeLessThanOrEqual(64);
  },
};
