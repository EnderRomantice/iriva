"use client";
import { useState } from 'react';

/** One native field preserves paste, autofill and keyboard editing across six visual slots. */
export function CodeInput({ busy, invalid }: { busy: boolean; invalid: boolean }) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  function update(input: HTMLInputElement, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    input.value = digits;
    setValue(digits);
    setCursor(Math.min(input.selectionStart ?? digits.length, 5));
    if (digits.length === 6 && !busy) input.form?.requestSubmit();
  }
  return <div className="sp-code-slots" data-invalid={invalid} data-busy={busy}>
    <div className="sp-code-digits" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => <span key={i} className="sp-code-digit" data-active={cursor === i}>{value[i] || ''}</span>)}
    </div>
    <input className="sp-code-native" aria-label="邮箱验证码" aria-invalid={invalid}
      name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
      pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus
      value={value} readOnly={busy}
      onChange={event => update(event.currentTarget, event.currentTarget.value)}
      onSelect={event => setCursor(Math.min(event.currentTarget.selectionStart ?? value.length, 5))}
      onPaste={event => {
        event.preventDefault();
        if (!busy) update(event.currentTarget, event.clipboardData.getData('text'));
      }} />
  </div>;
}
