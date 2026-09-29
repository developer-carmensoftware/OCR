import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlipViewer } from './SlipViewer'

describe('SlipViewer without a URL', () => {
  // A file storage no longer has (every slip from before the 2026-07-13 move) is a fact
  // the reviewer can act on; "unavailable" sent people looking for an outage.
  it('says the file is gone when storage answered 404', () => {
    render(<SlipViewer url={null} error="missing" />)
    expect(screen.getByText(/no longer in storage/)).toBeInTheDocument()
  })

  it('keeps the generic message for any other failure', () => {
    render(<SlipViewer url={null} error="failed" />)
    expect(screen.getByText('Slip preview unavailable.')).toBeInTheDocument()
  })
})
