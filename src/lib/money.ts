// All money is integer pence. These helpers are the only place pence meet £ strings.

// Postgres `int` max, so a typo like "20000000000" can't overflow the column
const MAX_PENCE = 2_147_483_647

/** 2000 → "£20", 1250 → "£12.50", -530 → "−£5.30" */
export function formatPence(pence: number): string {
  const sign = pence < 0 ? '−' : ''
  const abs = Math.abs(pence)
  const pounds = Math.floor(abs / 100)
  const rest = abs % 100
  const poundsText = pounds.toLocaleString('en-GB')
  return rest === 0
    ? `${sign}£${poundsText}`
    : `${sign}£${poundsText}.${String(rest).padStart(2, '0')}`
}

/** Like formatPence but always shows a sign: +£40, −£53, £0 */
export function formatNet(pence: number): string {
  return pence > 0 ? `+${formatPence(pence)}` : formatPence(pence)
}

/**
 * Parses what someone typed into a money input into pence.
 * Accepts "12", "12.5", "12.50", "£12.50", ".50", "1,000". Returns null for anything
 * else, including negatives and more than two decimal places.
 * Splits the string instead of multiplying by 100, so there's no floating-point rounding.
 */
export function parsePounds(input: string): number | null {
  const text = input.trim().replace(/^£/, '').replace(/,/g, '').trim()
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(text)
  if (!match) return null

  const [, whole, fraction = ''] = match
  if (whole === '' && fraction === '') return null

  const pence = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  return pence <= MAX_PENCE ? pence : null
}
