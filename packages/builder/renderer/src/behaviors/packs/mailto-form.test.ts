import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { mountMailtoForm } from './mailto-form';

function fakeWindow(): { location: { href: string }; sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    location: {
      get href() {
        return sent[sent.length - 1] ?? '';
      },
      set href(value: string) {
        sent.push(value);
      },
    },
  };
}

const FIELDS = `
  <label for="n">الاسم</label><input id="n" name="name" value="  ليلى  ">
  <input name="phone" aria-label="Phone" value="+962 79 000 0000">
  <label>Message <textarea name="message">Hi & welcome?</textarea></label>
  <input name="empty" value="">
  <input type="hidden" name="secret" value="x">
  <input type="checkbox" name="news" aria-label="News" value="yes">`;

function form(attrs: string, inner = `${FIELDS}<button type="button">Send</button>`): HTMLFormElement {
  document.body.innerHTML = `<form data-ck-behavior="mailto-form" ${attrs}>${inner}</form>`;
  return document.body.firstElementChild as HTMLFormElement;
}

function submit(el: HTMLFormElement): Event {
  const event = new Event('submit', { cancelable: true });
  el.dispatchEvent(event);
  return event;
}

function parse(url: string): { to: string; subject: string | null; body: string | null } {
  const [to = '', query = ''] = url.replace(/^mailto:/u, '').split('?');
  const params = new URLSearchParams(query);
  return { to, subject: params.get('subject'), body: params.get('body') };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

describe('mountMailtoForm', () => {
  it('builds mailto: with the first field as subject and labelled lines as body', () => {
    const el = form('data-ck-email="hello@example.com"');
    const win = fakeWindow();
    const dispose = mountMailtoForm(document, { window: win });
    expect(el.hasAttribute('data-ck-mounted')).toBe(true);
    const event = submit(el);
    expect(event.defaultPrevented).toBe(true);
    expect(win.sent).toHaveLength(1);
    const sent = win.sent[0]!;
    // Nothing a visitor typed reaches the address unencoded.
    expect(sent).not.toMatch(/[ &?]welcome/u);
    const mail = parse(sent);
    expect(mail.to).toBe('hello@example.com');
    expect(mail.subject).toBe('ليلى');
    expect(mail.body).toBe('الاسم: ليلى\r\nPhone: +962 79 000 0000\r\nMessage: Hi & welcome?');
    dispose();
  });

  it('falls back to the page title for the subject', () => {
    document.title = 'مطعم الياسمين';
    const el = form('data-ck-email="hello@example.com"', '<input name="x" value="">');
    const win = fakeWindow();
    const dispose = mountMailtoForm(document, { window: win });
    submit(el);
    expect(parse(win.sent[0]!)).toEqual({ to: 'hello@example.com', subject: 'مطعم الياسمين', body: null });
    dispose();
  });

  it('sends from its last button when no button declares submit, after validation', () => {
    const el = form('data-ck-email="hello@example.com"', '<input name="q" required value=""><button type="button">Send</button>');
    const win = fakeWindow();
    const dispose = mountMailtoForm(document, { window: win });
    const button = el.querySelector('button')!;
    button.click();
    expect(win.sent).toHaveLength(0);
    el.querySelector('input')!.value = 'Table for two';
    button.click();
    expect(parse(win.sent[0]!).body).toBe('q: Table for two');
    dispose();
  });

  it('is idempotent, and its disposer removes every listener', () => {
    const el = form('data-ck-email="hello@example.com"');
    const win = fakeWindow();
    const first = mountMailtoForm(document, { window: win });
    const second = mountMailtoForm(document, { window: win });
    submit(el);
    expect(win.sent).toHaveLength(1);
    second();
    first();
    submit(el);
    el.querySelector('button')!.click();
    expect(win.sent).toHaveLength(1);
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
  });

  it('mounts nothing for an address that is not a plain e-mail', () => {
    const el = form('data-ck-email="hello@example.com?cc=evil@example.com"');
    const win = fakeWindow();
    mountMailtoForm(document, { window: win });
    submit(el);
    expect(win.sent).toEqual([]);
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
  });

  it('is inert on the canvas', () => {
    const el = form('data-ck-email="hello@example.com"');
    const win = fakeWindow();
    const dispose = mountMailtoForm(document, { interactive: false, window: win });
    submit(el);
    el.querySelector('button')!.click();
    expect(win.sent).toEqual([]);
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
    dispose();
  });

  it('serialises: evaluated alone in a fresh document, it mounts and sends', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.body.innerHTML =
      '<form data-ck-behavior="mailto-form" data-ck-email="hi@example.com"><input aria-label="البريد" value="a@b.co"></form>';
    const win = fakeWindow();
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', 'win', `(${mountMailtoForm.toString()})(document, { window: win });`)(fresh, win);
    const target = fresh.querySelector('form')!;
    target.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(parse(win.sent[0]!).body).toBe('البريد: a@b.co');
    frame.remove();
  });

  it('weighs at most 2 kB gzip serialised', () => {
    expect(gzipSync(mountMailtoForm.toString()).length).toBeLessThanOrEqual(2048);
  });
});
