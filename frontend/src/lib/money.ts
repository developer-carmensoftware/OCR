/** Format a baht amount with thousands separators. `withDecimals` shows .00. */
export function formatThb(value: number | string, withDecimals = false): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

const _ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const _TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function _hundreds(n: number): string {
  let s = ''
  if (n >= 100) {
    s += `${_ONES[Math.floor(n / 100)]} Hundred `
    n %= 100
  }
  if (n >= 20) {
    s += `${_TENS[Math.floor(n / 10)]} `
    n %= 10
  }
  if (n > 0) s += `${_ONES[n]} `
  return s.trim()
}

/** Spell a baht amount in English words, e.g. 490 → "Four Hundred Ninety Baht Only". */
export function bahtToEnglishWords(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value) || value === 0) return 'Zero Baht Only'

  const [intStr, decStr] = value.toFixed(2).split('.')
  let intPart = parseInt(intStr, 10)
  const satang = parseInt(decStr, 10)

  let result = ''
  const scales: [number, string][] = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
    [1, ''],
  ]
  for (const [size, label] of scales) {
    const chunk = Math.floor(intPart / size)
    intPart %= size
    if (chunk > 0) result += `${_hundreds(chunk)}${label ? ` ${label}` : ''} `
  }
  result = `${result.trim()} Baht`
  result += satang > 0 ? ` and ${_hundreds(satang)} Satang` : ' Only'
  return result.replace(/\s+/g, ' ').trim()
}

const _TH_DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const _TH_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/** Read a 1–999,999 group into Thai words (no scale suffix). */
function _thReadGroup(n: number): string {
  let s = ''
  const digits = String(n).split('').map(Number)
  const len = digits.length
  digits.forEach((d, i) => {
    if (d === 0) return
    const pos = len - 1 - i // 0 = units, 1 = tens, ...
    if (pos === 1 && d === 1) {
      s += 'สิบ' // สิบ, not หนึ่งสิบ
    } else if (pos === 1 && d === 2) {
      s += 'ยี่สิบ' // ยี่สิบ, not สองสิบ
    } else if (pos === 0 && d === 1 && len > 1) {
      s += 'เอ็ด' // trailing 1 in a multi-digit number
    } else {
      s += _TH_DIGITS[d] + _TH_POS[pos]
    }
  })
  return s
}

/**
 * Spell a baht amount in Thai words, e.g. 490 → "สี่ร้อยเก้าสิบบาทถ้วน".
 * ponytail: groups read independently, so a lone trailing "1" across a ล้าน
 * boundary (1,000,001) reads "…หนึ่ง" not "…เอ็ด". Unreachable at billing
 * amounts (hundreds–thousands of baht); add cross-group เอ็ด if that changes.
 */
export function bahtToThaiWords(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value) || value === 0) return 'ศูนย์บาทถ้วน'

  const [intStr, decStr] = value.toFixed(2).split('.')
  let intPart = parseInt(intStr, 10)
  const satang = parseInt(decStr, 10)

  let baht = ''
  if (intPart > 0) {
    // Split into million-sized groups, high → low; join with ล้าน.
    const groups: number[] = []
    while (intPart > 0) {
      groups.unshift(intPart % 1_000_000)
      intPart = Math.floor(intPart / 1_000_000)
    }
    baht = groups.map(_thReadGroup).join('ล้าน')
  }

  let result = baht ? `${baht}บาท` : 'บาท'
  result += satang > 0 ? `${_thReadGroup(satang)}สตางค์` : 'ถ้วน'
  return result
}
