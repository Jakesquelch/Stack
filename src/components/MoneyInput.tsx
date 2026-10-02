import type { InputHTMLAttributes } from 'react'

/** A £ input that brings up the number pad with a decimal point. Parse the value with parsePounds. */
export function MoneyInput({
  value,
  onChange,
  className = '',
  ...rest
}: { value: string; onChange: (value: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400">£</span>
      <input
        {...rest}
        className="input pl-8 tabular-nums"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
