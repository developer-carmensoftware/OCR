import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type React from 'react'
import { useFileUpload } from './useFileUpload'

// ─── helpers ──────────────────────────────────────────────────────────────────

const BLOB_URL = 'blob:http://localhost/fake-object-url'

function makeImageFile(name = 'receipt.jpg') {
  return new File(['img-content'], name, { type: 'image/jpeg' })
}
function makePDFFile(name = 'invoice.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}
function makeChangeEvent(files: File[]) {
  return {
    target: { files: files.length ? files : null },
  } as unknown as React.ChangeEvent<HTMLInputElement>
}

/**
 * Vitest's own per-test timeout is 5s, which killed the PDF test before the 10s
 * `waitFor` budget below could ever be spent — so the 2026-08-21 flake fix never took
 * effect in a full-suite run. Both numbers are needed; raising only one does nothing.
 */
const PDF_PARSE_TIMEOUT_MS = 15_000

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => BLOB_URL),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── F1: handleFileChange ─────────────────────────────────────────────────────

  describe('F1: handleFileChange', () => {
    it('does nothing when no files are selected', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([]))
      })
      expect(result.current.files).toHaveLength(0)
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('does nothing when files list is empty', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([]))
      })
      expect(result.current.files).toHaveLength(0)
    })

    it('stores selected files in state', () => {
      const { result } = renderHook(() => useFileUpload())
      const file = makeImageFile()
      act(() => {
        result.current.handleFileChange(makeChangeEvent([file]))
      })
      expect(result.current.files).toHaveLength(1)
      expect(result.current.files[0]).toBe(file)
    })

    it('calls onFilesReady callback with the selected files', () => {
      const { result } = renderHook(() => useFileUpload())
      const file = makeImageFile()
      const onFilesReady = vi.fn()
      act(() => {
        result.current.handleFileChange(makeChangeEvent([file]), onFilesReady)
      })
      expect(onFilesReady).toHaveBeenCalledWith([file])
    })

    it('sets previewType=image for jpeg files', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([makeImageFile('photo.jpg')]))
      })
      expect(result.current.previewType).toBe('image')
      expect(result.current.previewUrl).toBe(BLOB_URL)
    })

    it('sets previewType=image for png files', () => {
      const { result } = renderHook(() => useFileUpload())
      const png = new File(['data'], 'screenshot.png', { type: 'image/png' })
      act(() => {
        result.current.handleFileChange(makeChangeEvent([png]))
      })
      expect(result.current.previewType).toBe('image')
    })

    it(
      'sets previewType=pdf and appends #view=FitH for PDF files',
      async () => {
        // The PDF preview now extracts only page 1 (credit card is single-page).
        // In the test env pdf-lib can't parse the tiny stub, so the fallback path
        // produces #page=1&view=FitH.
        const { result } = renderHook(() => useFileUpload())
        act(() => {
          result.current.handleFileChange(makeChangeEvent([makePDFFile()]))
        })
        expect(result.current.previewType).toBe('pdf')
        // 10s, not the 1s default: this waits on a pdf-lib parse, which takes seconds
        // when the whole suite runs in parallel. Flaked in CI at the default.
        await waitFor(
          () => {
            expect(result.current.previewUrl).not.toBeNull()
            expect(result.current.previewUrl).toContain('view=FitH')
          },
          { timeout: 10_000 }
        )
      },
      PDF_PARSE_TIMEOUT_MS
    )

    it('sets previewType to uppercase extension for unsupported file types', () => {
      const { result } = renderHook(() => useFileUpload())
      const xlsx = new File(['data'], 'report.xlsx', { type: 'application/vnd.ms-excel' })
      act(() => {
        result.current.handleFileChange(makeChangeEvent([xlsx]))
      })
      expect(result.current.previewType).toBe('XLSX')
      expect(result.current.previewUrl).toBeNull()
    })

    it('revokes the previous object URL before creating a new one', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([makeImageFile('first.jpg')]))
      })
      act(() => {
        result.current.handleFileChange(makeChangeEvent([makeImageFile('second.jpg')]))
      })
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    })
  })

  // ── F2: clearFiles ───────────────────────────────────────────────────────────

  describe('F2: clearFiles', () => {
    it('revokes the object URL when clearing', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([makeImageFile()]))
      })
      act(() => {
        result.current.clearFiles()
      })
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('resets files, previewUrl, and previewType to initial state', () => {
      const { result } = renderHook(() => useFileUpload())
      act(() => {
        result.current.handleFileChange(makeChangeEvent([makeImageFile()]))
      })
      act(() => {
        result.current.clearFiles()
      })
      expect(result.current.files).toHaveLength(0)
      expect(result.current.previewUrl).toBeNull()
      expect(result.current.previewType).toBeNull()
    })

    it('clears fileInputRef.value when ref is attached', () => {
      const { result } = renderHook(() => useFileUpload())
      result.current.fileInputRef.current = { value: 'C:\\fakepath\\file.jpg' } as HTMLInputElement
      act(() => {
        result.current.clearFiles()
      })
      expect(result.current.fileInputRef.current?.value).toBe('')
    })

    it('does not throw when called with no files selected', () => {
      const { result } = renderHook(() => useFileUpload())
      expect(() => {
        act(() => {
          result.current.clearFiles()
        })
      }).not.toThrow()
    })
  })

  // ── F3: initial state ────────────────────────────────────────────────────────

  describe('F3: initial state', () => {
    it('starts with empty files and null preview', () => {
      const { result } = renderHook(() => useFileUpload())
      expect(result.current.files).toEqual([])
      expect(result.current.previewUrl).toBeNull()
      expect(result.current.previewType).toBeNull()
      expect(result.current.fileInputRef.current).toBeNull()
    })
  })
})
