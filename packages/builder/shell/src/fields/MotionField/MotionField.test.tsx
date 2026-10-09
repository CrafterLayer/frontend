import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { motionSpecSchema } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { MotionField } from './MotionField';

function renderField(value: unknown, onChange = vi.fn(), disabled?: boolean) {
  /*
    `disabled` is spread rather than passed directly: under
    `exactOptionalPropertyTypes` the prop means "absent, or a boolean" — never
    the value `undefined` — so handing it `boolean | undefined` is a type error.
  */
  render(
    <MotionField
      schema={motionSpecSchema}
      value={value}
      path={['motion']}
      onChange={onChange}
      {...(disabled === undefined ? {} : { disabled })}
      controlId="motion"
    />,
  );
  return onChange;
}

describe('MotionField', () => {
  it('offers every part of the motion decision by an accessible name', () => {
    renderField({});

    expect(screen.getByLabelText('On entry')).toBeInTheDocument();
    expect(screen.getByLabelText('While scrolling')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration')).toBeInTheDocument();
    expect(screen.getByLabelText('Delay')).toBeInTheDocument();
    expect(screen.getByLabelText('Easing')).toBeInTheDocument();
    expect(screen.getByLabelText('Stagger children')).toBeInTheDocument();
    expect(screen.getByLabelText('Replay on re-entry')).toBeInTheDocument();
  });

  it('shows the current motion rather than an empty control', () => {
    renderField({ reveal: 'fade-up', duration: 'slow' });

    expect(screen.getByLabelText<HTMLSelectElement>('On entry').value).toBe('fade-up');
    expect(screen.getByLabelText<HTMLSelectElement>('Duration').value).toBe('slow');
  });

  it('commits a chosen effect as a whole spec', async () => {
    const onChange = renderField({});

    await userEvent.selectOptions(screen.getByLabelText('On entry'), 'zoom-in');

    expect(onChange).toHaveBeenCalledWith({ reveal: 'zoom-in' });
  });

  it('keeps the parts a person already chose when another changes', async () => {
    const onChange = renderField({ reveal: 'fade', easing: 'spring' });

    await userEvent.selectOptions(screen.getByLabelText('Duration'), 'fast');

    expect(onChange).toHaveBeenCalledWith({ reveal: 'fade', easing: 'spring', duration: 'fast' });
  });

  /*
    A JSON document cannot hold `undefined`, so clearing has to REMOVE the key.
    Storing it would round-trip to an absent key anyway, and the two states
    would then disagree about what the document says.
  */
  it('removes a cleared part rather than storing undefined', async () => {
    const onChange = renderField({ reveal: 'fade', duration: 'slow' });

    await userEvent.selectOptions(screen.getByLabelText('Duration'), '');

    expect(onChange).toHaveBeenCalledWith({ reveal: 'fade' });
    expect(onChange.mock.calls[0]?.[0]).not.toHaveProperty('duration');
  });

  it('turns replay on', async () => {
    const onChange = renderField({ reveal: 'fade' });

    await userEvent.click(screen.getByLabelText('Replay on re-entry'));

    expect(onChange).toHaveBeenCalledWith({ reveal: 'fade', repeat: true });
  });

  /*
    Off is the ABSENCE of the flag, not `repeat: false`. Both render the same,
    so storing the explicit false would leave a document carrying a key that
    means nothing — and two documents that behave identically would stop being
    equal, which the round-trip law would then have to explain.
  */
  it('turns replay off by removing the flag rather than storing false', async () => {
    const onChange = renderField({ reveal: 'fade', repeat: true });

    await userEvent.click(screen.getByLabelText('Replay on re-entry'));

    expect(onChange).toHaveBeenCalledWith({ reveal: 'fade' });
    expect(onChange.mock.calls[0]?.[0]).not.toHaveProperty('repeat');
  });

  /*
    The one door a literal could re-enter the document through. Every control
    here is a select over a closed vocabulary; none accepts free text or a
    number, so `duration: 300` is not expressible from the inspector.
  */
  it('never offers a free-text or numeric input for a timing', () => {
    const { container } = render(
      <MotionField
        schema={motionSpecSchema}
        value={{}}
        path={['motion']}
        onChange={vi.fn()}
        controlId="motion"
      />,
    );

    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0);
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
  });

  it('emits only values the schema accepts', async () => {
    const onChange = renderField({});

    await userEvent.selectOptions(screen.getByLabelText('While scrolling'), 'pin');

    const emitted: unknown = onChange.mock.calls[0]?.[0];
    expect(motionSpecSchema.safeParse(emitted).success).toBe(true);
  });

  it('disables every control when the row is disabled', () => {
    renderField({}, vi.fn(), true);

    expect(screen.getByLabelText<HTMLSelectElement>('On entry')).toBeDisabled();
    expect(screen.getByLabelText<HTMLInputElement>('Replay on re-entry')).toBeDisabled();
  });

  it('treats a malformed stored value as no motion rather than crashing', () => {
    renderField('not an object');

    expect(screen.getByLabelText<HTMLSelectElement>('On entry').value).toBe('');
  });
});

// gsap-pixi additions (2026-10-08)
describe('MotionField — Cinematic motion and Animated background', () => {
  it('a recipe is one whole-spec change that keeps the other parts and drops "On entry"', async () => {
    const onChange = renderField({ reveal: 'fade-up', duration: 'slow' });

    await userEvent.click(screen.getByRole('button', { name: 'Stagger in' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ duration: 'slow', timeline: 'stagger-in' });
    expect(motionSpecSchema.safeParse(onChange.mock.calls[0]?.[0]).success).toBe(true);
  });

  it('shows the stored recipe and scene; how it plays, the scene and its density each write the spec', async () => {
    const onChange = renderField({ timeline: 'fade-in', scene: 'particles', sceneDensity: 'low' });

    expect(screen.getByRole('button', { name: 'Fade in' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Particles' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'With scroll' }));
    expect(onChange).toHaveBeenLastCalledWith({
      timeline: 'fade-in',
      scrub: true,
      scene: 'particles',
      sceneDensity: 'low',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Mesh gradient' }));
    expect(onChange).toHaveBeenLastCalledWith({ timeline: 'fade-in', scene: 'mesh-gradient', sceneDensity: 'low' });
    await userEvent.click(screen.getByRole('radio', { name: 'High' }));
    expect(onChange).toHaveBeenLastCalledWith({ timeline: 'fade-in', scene: 'particles', sceneDensity: 'high' });
    for (const call of onChange.mock.calls) expect(motionSpecSchema.safeParse(call[0]).success).toBe(true);
  });

  it('clearing removes the keys; choosing an entry effect takes the recipe off', async () => {
    const onChange = renderField({ timeline: 'slide-in', scrub: false, duration: 'fast' });

    await userEvent.click(within(screen.getByRole('group', { name: 'Cinematic motion' })).getByRole('button', { name: 'None' }));
    expect(onChange).toHaveBeenLastCalledWith({ duration: 'fast' });
    await userEvent.selectOptions(screen.getByLabelText('On entry'), 'zoom-in');
    expect(onChange).toHaveBeenLastCalledWith({ duration: 'fast', reveal: 'zoom-in' });
  });

  it('speaks the editor’s language: Arabic names, right to left', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <MotionField schema={motionSpecSchema} value={{}} path={['motion']} onChange={vi.fn()} controlId="motion-ar" />
      </FieldServicesProvider>,
    );

    expect(screen.getByRole('group', { name: 'حركة سينمائية' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'خلفية متحركة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'جزيئات' })).toBeInTheDocument();
  });
});
// ── end gsap-pixi additions ──
