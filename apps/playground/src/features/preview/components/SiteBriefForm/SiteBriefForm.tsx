import { useActionState, useId } from 'react';

import type { AgentLocale } from '../AgentFace';
import { IconSparkle } from '../AssistantPanel/AssistantPanel.icons';

/**
 * What the last submit left behind.
 *
 * The brief is kept because the field is uncontrolled — React resets a form on
 * submit, and a person whose brief was refused should not have to type it
 * again. `refused` separates the two failures a person experiences quite
 * differently: the form declining to start (nothing happened, fix the sentence)
 * and a run that started and came back with a reason.
 */
export interface SiteBriefState {
  readonly brief: string;
  readonly message?: string | undefined;
  readonly refused?: boolean | undefined;
}

export interface SiteBriefFormProps {
  /**
   * Hands the brief to whoever runs it. Resolves with a reason when it was not
   * ADMITTED, and with `undefined` when it was.
   *
   * Admission, not completion — and the difference is forced by React. Every
   * state update made inside an Action is a transition update, so a host that
   * awaited a five-stage run here would have held its own re-render for the
   * whole of it: no progress, no stages, not one frame until the moment it was
   * already over. The Action ends when the run is accepted; what happens after
   * belongs to whatever is showing the run.
   */
  readonly onSubmit: (brief: string) => Promise<string | undefined>;
  readonly locale?: AgentLocale | undefined;
  /** Another run owns the panel; this form may not start a second one. */
  readonly busy?: boolean | undefined;
  /** Pre-fills the field — a resumed brief, or a story. */
  readonly defaultValue?: string | undefined;
}

const LABELS = {
  ar: {
    label: 'صف الموقع الذي تريده',
    placeholder: 'مشغل خزف في عمّان: رئيسية، أعمال، تواصل',
    hint: 'جملة واحدة تكفي. كل صفحة تُكتب من هذه الجملة، فكلما كانت أدقّ كان الموقع أقرب لك.',
    submit: 'ابنِ الموقع',
    building: 'يبني الموقع…',
    empty: 'اكتب جملة عن الموقع أولاً: ما هو، ولمن.',
    busy: 'هناك تشغيل جارٍ الآن. أوقفه قبل بدء آخر.',
  },
  en: {
    label: 'Describe the site you want',
    placeholder: 'A ceramics studio in Amman: home, work, contact',
    hint: 'One sentence is enough. Every page is written from it, so the more specific it is the closer the site lands.',
    submit: 'Build the site',
    building: 'Building the site…',
    empty: 'Write a sentence about the site first: what it is, and who it is for.',
    busy: 'A run is already going. Stop it before starting another.',
  },
} as const;

/**
 * The brief: one sentence in, a whole site out.
 *
 * ## Why an Action and not an `onClick`
 *
 * A site build is five calls and minutes long, and the two things a person
 * needs from the form during it — that it is running, and that it must not be
 * started twice — are exactly what `useActionState` reports. Deriving them from
 * a `useState` boolean means owning the moment it is set and every path where
 * it must be cleared, and one missed path leaves a form that never unlocks.
 * Here "pending" ends when the promise settles, including when it rejects.
 *
 * ## Why a refusal is not an error
 *
 * A blank brief is not a failure of the run; it is the form declining to start
 * one. Saying so without a spinner, without an entry in history, and without
 * anything to undo is the honest answer — and the person's sentence stays in
 * the field, because losing what they typed to tell them it was not enough
 * would be its own small insult.
 */
export function SiteBriefForm({
  onSubmit,
  locale = 'ar',
  busy = false,
  defaultValue = '',
}: SiteBriefFormProps) {
  const copy = LABELS[locale];
  const fieldId = useId();
  const hintId = useId();
  const messageId = useId();

  const [state, submit, pending] = useActionState<SiteBriefState, FormData>(
    async (_previous, form) => {
      /*
        A `FormData` value is a string OR a File, and `String(file)` is
        "[object File]" — a brief nobody typed, which would then be sent to a
        model. Narrowed rather than coerced.
      */
      const entry = form.get('brief');
      const brief = typeof entry === 'string' ? entry.trim() : '';
      if (brief === '') {
        return { brief: '', message: copy.empty, refused: true };
      }
      if (busy) {
        return { brief, message: copy.busy, refused: true };
      }
      const reason = await onSubmit(brief);
      return reason === undefined ? { brief } : { brief, message: reason };
    },
    { brief: defaultValue },
  );

  const locked = busy || pending;
  const described = [hintId, state.message === undefined ? '' : messageId]
    .filter((id) => id !== '')
    .join(' ');

  return (
    <form className="pg-brief" action={submit}>
      <label className="pg-brief__label" htmlFor={fieldId}>
        {copy.label}
      </label>
      <textarea
        id={fieldId}
        name="brief"
        className="pg-brief__field"
        dir="auto"
        rows={3}
        defaultValue={state.brief}
        placeholder={copy.placeholder}
        disabled={locked}
        aria-describedby={described}
        aria-invalid={state.refused === true}
      />

      <p id={hintId} className="pg-brief__hint">
        {copy.hint}
      </p>

      {/*
        One live region, polite. The button's own label changes too, but a label
        on a DISABLED control is not reliably announced — so the state that
        matters most while waiting is said here, where it always reaches.
      */}
      <p className="pg-brief__status" role="status">
        {pending ? copy.building : ''}
      </p>

      {state.message === undefined ? null : (
        <p
          id={messageId}
          className="pg-brief__message"
          data-refused={state.refused === true}
          dir="auto"
        >
          {state.message}
        </p>
      )}

      <div className="pg-brief__actions">
        {/*
          A native button, not `ChromeButton`. That component omits `type` from
          its props and writes `type="button"` itself — it is deliberately never
          a submit button — and a form Action needs one. Widening a shared
          component for a single caller costs every other caller a prop they
          must now think about.
        */}
        <button type="submit" className="pg-brief__submit" disabled={locked}>
          <IconSparkle />
          {pending ? copy.building : copy.submit}
        </button>
      </div>
    </form>
  );
}
