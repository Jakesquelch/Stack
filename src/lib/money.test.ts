import { describe, expect, it } from 'vitest'
import { formatNet, formatPence, parsePounds } from './money'

describe('formatPence', () => {
  it('drops the pence on whole pounds', () => {
    expect(formatPence(2000)).toBe('£20')
    expect(formatPence(0)).toBe('£0')
  })

  it('shows two decimal places otherwise', () => {
    expect(formatPence(1250)).toBe('£12.50')
    expect(formatPence(1225)).toBe('£12.25')
    expect(formatPence(5)).toBe('£0.05')
  })

  it('uses a minus sign for negatives', () => {
    expect(formatPence(-5300)).toBe('−£53')
    expect(formatPence(-530)).toBe('−£5.30')
  })

  it('groups thousands', () => {
    expect(formatPence(123456)).toBe('£1,234.56')
  })
})

describe('formatNet', () => {
  it('always shows the sign', () => {
    expect(formatNet(4000)).toBe('+£40')
    expect(formatNet(-5300)).toBe('−£53')
    expect(formatNet(0)).toBe('£0')
  })
})

describe('parsePounds', () => {
  it('parses whole pounds', () => {
    expect(parsePounds('20')).toBe(2000)
    expect(parsePounds('0')).toBe(0)
  })

  it('parses pence', () => {
    expect(parsePounds('12.5')).toBe(1250)
    expect(parsePounds('12.50')).toBe(1250)
    expect(parsePounds('12.25')).toBe(1225)
    expect(parsePounds('.5')).toBe(50)
    expect(parsePounds('7.')).toBe(700)
  })

  it('has no floating-point rounding errors', () => {
    // 0.29 * 100 === 28.999999999999996 in JS
    expect(parsePounds('0.29')).toBe(29)
    expect(parsePounds('1.15')).toBe(115)
    expect(parsePounds('4.35')).toBe(435)
  })

  it('ignores a £ sign, commas and whitespace', () => {
    expect(parsePounds(' £12.50 ')).toBe(1250)
    expect(parsePounds('1,000')).toBe(100000)
  })

  it('rejects anything else', () => {
    for (const bad of ['', ' ', '.', '£', 'abc', '12.505', '-5', '1.2.3', '12p', '1e3']) {
      expect(parsePounds(bad), bad).toBeNull()
    }
  })

  it('rejects amounts too big for the database', () => {
    expect(parsePounds('21474836.47')).toBe(2_147_483_647)
    expect(parsePounds('21474836.48')).toBeNull()
  })

  it('round-trips every pence value up to £100', () => {
    for (let p = 0; p <= 10000; p++) {
      expect(parsePounds(formatPence(p))).toBe(p)
    }
  })
})
