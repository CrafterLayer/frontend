import { useEffect, useId, useRef, useState } from 'react';

export interface TextBubblePromptSpec {
  /** The field's visible label ("Link address"). */
  label: string;
  submitLabel: string;
  cancelLabel: string;
  initialValue?: string | undefined;
  /** Text direction of what is typed — a URL is `ltr` on any page. */
  dir?: 'ltr' | 'rtl' | undefined;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export interface TextBubblePromptProps {
  prompt: TextBubblePromptSpec;
}

/**
 * The bubble's one-field form (a link address while formatting tree text,
 * style-manager DESIGN.md §E). It takes focus when it opens; Enter submits and
 * Escape cancels — both stay inside the bubble.
 */
export function TextBubblePrompt({ prompt }: TextBubblePromptProps) {
  const id = useId();
  const [value, setValue] = useState(prompt.initialValue ?? '');
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form
      className="bldr-text-bubble__prompt"
      onSubmit={(event) => {
        event.preventDefault();
        prompt.onSubmit(value.trim());
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        prompt.onCancel();
      }}
    >
      <label className="bldr-text-bubble__prompt-label" htmlFor={id}>
        {prompt.label}
      </label>
      <input
        ref={input}
        id={id}
        className="bldr-text-bubble__prompt-input"
        type="text"
        dir={prompt.dir ?? 'ltr'}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
        }}
      />
      <button type="submit" className="bldr-text-bubble__action">
        {prompt.submitLabel}
      </button>
      <button type="button" className="bldr-text-bubble__action" onClick={prompt.onCancel}>
        {prompt.cancelLabel}
      </button>
    </form>
  );
}
