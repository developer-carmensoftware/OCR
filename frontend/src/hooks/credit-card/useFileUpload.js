import { useState, useRef } from 'react'

/**
 * Manages file selection state and document preview URL lifecycle.
 * Handles image vs PDF detection and Object URL cleanup.
 */
export function useFileUpload() {
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const fileInputRef = useRef(null)

  function setPreview(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    const name = file.name.toLowerCase()
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
      setPreviewType(name.split('.').pop().toUpperCase() || 'other')
    }
  }

  function handleFileChange(e, onFilesReady) {
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
