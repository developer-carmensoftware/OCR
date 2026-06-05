import { useState, useRef } from 'react'
import type React from 'react'
import { getFilePreview } from '../../lib/api/ocr'

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
      setPreviewUrl(URL.createObjectURL(file) + '#view=FitH')
      setPreviewType('pdf')
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
