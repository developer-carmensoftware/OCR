import { describe, it, expect } from 'vitest'
import { classify } from './ExtractionsPage'

/**
 * classify() is the only non-trivial logic on the Extractions page: it folds raw
 * error_message text into the buckets the grouped tab renders. If a real failure
 * string stops matching, the page silently under-reports instead of erroring —
 * which is exactly the failure mode this page exists to prevent.
 */
describe('classify', () => {
  it('buckets password-protected PDFs', () => {
    expect(classify('document closed or encrypted')).toBe('pdfEncrypted')
    expect(classify('This PDF is password-protected. Please enter its password.')).toBe(
      'pdfEncrypted'
    )
  })

  it('buckets every shape of bad model JSON', () => {
    // Same document, three attempts, three different truncation points — the model
    // returns a different broken payload each time. All one cause.
    expect(classify('Unterminated string starting at: line 34 column 22 (char 839)')).toBe(
      'llmBadJson'
    )
    expect(classify('Unterminated string starting at: line 1 column 101 (char 100)')).toBe(
      'llmBadJson'
    )
    // Model answered in prose instead of JSON.
    expect(classify('Expecting value: line 1 column 1 (char 0)')).toBe('llmBadJson')
  })

  it('buckets the user-facing LLMParseError message', () => {
    // REGRESSION GUARD. error_message is str(exc); once LLMParseError carries a
    // friendly default, every future JSON failure writes THIS sentence and the raw
    // parser text lives only in the server log. Without this rule the page goes
    // blind on new failures while still looking healthy. If someone edits that
    // default message, this test is what tells them the page depends on it.
    expect(
      classify('Could not read this document. Please try again, or upload a clearer photo or PDF.')
    ).toBe('llmBadJson')
  })

  it('buckets upstream and quota failures', () => {
    expect(classify('LLM provider unavailable: timed out')).toBe('llmUnavailable')
    expect(classify('Free trial document quota exhausted')).toBe('quotaExhausted')
    expect(classify('Carmen token rejected')).toBe('carmenDown')
  })

  it('separates "no message recorded" from "message we do not recognise"', () => {
    // 'unknown' is a data gap; 'other' is a real error we have no rule for. Merging
    // them hides new failure modes behind an empty-looking bucket.
    expect(classify(null)).toBe('unknown')
    expect(classify('')).toBe('unknown')
    expect(classify('something nobody has seen before')).toBe('other')
  })

  it('is ordered — the first matching rule wins', () => {
    // Contains both "quota" and "timeout"; llmUnavailable is declared first.
    expect(classify('request timeout while checking quota')).toBe('llmUnavailable')
  })
})
