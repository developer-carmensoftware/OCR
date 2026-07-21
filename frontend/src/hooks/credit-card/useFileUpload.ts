import { useState, useRef } from 'react'
import type React from 'react'
import { getFilePreview } from '../../lib/api/ocr'
import { checkFilesSize } from '../../lib/fileValidation'
import { showToast } from '../../lib/toast'
import { sanitizedPdfUrl } from '../../lib/pdfPreview'
import { selectedPagesToPdfUrl } from '../../lib/pdfPages'

const HEIC_RE = /\.(heic|heif)$/i

export interface FileUploadHook {
  files: File[]
  setFiles: React.Dispatch<React.SetStateAction<File[]>>
  previewUrl: string | null
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>
  previewType: string | null
  setPreviewType: React.Dispatch<React.SetStateAction<string | null>>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    onFilesReady?: (files: File[]) => void
  ) => void
  clearFiles: () => void
}

export function useFileUpload(): FileUploadHook {
  const [files, setFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function setPreview(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    const name = file.name.toLowerCase()
    // HEIC/HEIF can't be decoded by browsers — fetch a server-converted JPEG.
    if (HEIC_RE.test(name) || file.type === 'image/heic' || file.type === 'image/heif') {
      setPreviewType('image')
      setPreviewUrl(null)
      getFilePreview(file)
        .then(setPreviewUrl)
        .catch(() => setPreviewType('HEIC')) // fall back to the unsupported-type card
      return
    }
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(name)
    const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(name)
    if (isImage) {
      setPreviewUrl(URL.createObjectURL(file))
      setPreviewType('image')
    } else if (isPDF) {
      // Credit card always processes only page 1 — show only that page in the
      // preview so users aren't confused by the remaining pages.
      setPreviewType('pdf')
      setPreviewUrl(null)
      selectedPagesToPdfUrl(file, [0])
        .then(u => setPreviewUrl(u + '#view=FitH'))
        .catch(() => {
          // Subset extraction failed — fall back to full PDF starting at page 1.
          sanitizedPdfUrl(file).then(u => setPreviewUrl(u + '#page=1&view=FitH'))
        })
    } else {
      setPreviewUrl(null)
      setPreviewType(name.split('.').pop()?.toUpperCase() || 'other')
    }
  }

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    onFilesReady?: (files: File[]) => void
  ) {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    const fileArray = Array.from(selectedFiles)
    const sizeError = checkFilesSize(fileArray)
    if (sizeError) {
      showToast(sizeError, 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFiles(fileArray)
    setPreview(fileArray[0])
    if (onFilesReady) onFilesReady(fileArray)
  }

  function clearFiles() {
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    setFiles([])
    setPreviewUrl(null)
    setPreviewType(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return {
    files,
    setFiles,
    previewUrl,
    setPreviewUrl,
    previewType,
    setPreviewType,
    fileInputRef,
    handleFileChange,
    clearFiles,
  }
}
