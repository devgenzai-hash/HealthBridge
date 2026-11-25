'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { validateUploadFile, formatFileSize } from '@/lib/utils'
import { Camera, Image, FileUp, Upload, CheckCircle, Loader2, AlertCircle } from 'lucide-react'

type UploadStep = 'select' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error'

export default function ReportUploadPage() {
  const { patientId } = useAuth()
  const [step, setStep] = useState<UploadStep>('select')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validation = validateUploadFile(selectedFile)
    if (!validation.valid) {
      setError(validation.error!)
      return
    }

    setFile(selectedFile)
    setError(null)

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(selectedFile)
    } else {
      setPreview(null)
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }
    if (!patientId) {
      setError('Not authenticated. Please login again.')
      return
    }

    setStep('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('patientId', patientId)
      if (customTitle.trim()) {
        formData.append('title', customTitle.trim())
      }

      const response = await fetch('/api/reports/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { recordId } = await response.json()
      setStep('extracting')

      // Trigger analysis
      const analyzeResponse = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      })

      setStep('analyzing')

      if (!analyzeResponse.ok) {
        const data = await analyzeResponse.json()
        throw new Error(data.error || 'Analysis failed')
      }

      setReportId(recordId)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setStep('error')
    }
  }, [file, patientId])

  // Progress states UI
  if (step !== 'select' && step !== 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          {/* Progress Steps */}
          <div className="mb-8 space-y-4">
            <ProgressStep
              label="Uploading report"
              status={step === 'uploading' ? 'active' : 'done'}
            />
            <ProgressStep
              label="Extracting text (OCR)"
              status={step === 'extracting' ? 'active' : step === 'uploading' ? 'pending' : 'done'}
            />
            <ProgressStep
              label="AI analysis"
              status={step === 'analyzing' ? 'active' : ['uploading', 'extracting'].includes(step) ? 'pending' : 'done'}
            />
          </div>

          {step === 'done' && (
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle size={32} className="text-success" />
              </div>
              <p className="text-lg font-semibold text-text">Analysis Complete!</p>
              <button
                onClick={() => router.push(`/reports/${reportId}`)}
                className="btn-primary w-full"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-2 text-xl font-bold text-text">Upload Report</h1>
      <p className="mb-6 text-sm text-muted">
        Upload a lab report to get an AI-powered analysis
      </p>

      {/* Upload Options */}
      {!file ? (
        <div className="space-y-3">
          {/* Camera */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Camera size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Take a Photo</p>
              <p className="text-xs text-muted">Use your camera to capture the report</p>
            </div>
          </button>

          {/* Gallery */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*'
                fileInputRef.current.click()
              }
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Image size={22} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Choose from Gallery</p>
              <p className="text-xs text-muted">Select an image from your photos</p>
            </div>
          </button>

          {/* PDF */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = '.pdf,application/pdf'
                fileInputRef.current.click()
              }
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
              <FileUp size={22} className="text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Upload PDF</p>
              <p className="text-xs text-muted">Select a PDF lab report file</p>
            </div>
          </button>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
              e.target.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
              e.target.value = ''
            }}
          />

          <p className="pt-2 text-center text-xs text-muted">
            Supported: JPEG, PNG, WebP, PDF • Max 10MB
          </p>
        </div>
      ) : (
        /* File Preview + Upload */
        <div className="space-y-4">
          {preview && (
            <div className="overflow-hidden rounded-xl border border-border">
              <img src={preview} alt="Report preview" className="w-full object-contain" style={{ maxHeight: 300 }} />
            </div>
          )}

          <div className="card flex items-center gap-3">
            <FileUp size={20} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{file.name}</p>
              <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              className="text-xs text-danger"
            >
              Remove
            </button>
          </div>

          {/* Custom Title */}
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-text">
              Report Name <span className="text-muted">(optional)</span>
            </label>
            <input
              id="title"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Blood Test May 2024"
              className="input"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button onClick={handleUpload} className="btn-primary w-full gap-2">
            <Upload size={16} />
            Analyze Report
          </button>
        </div>
      )}

      {/* Error state */}
      {step === 'error' && error && (
        <div className="mt-4 rounded-lg bg-danger/10 p-4 text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-danger" />
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => { setStep('select'); setError(null) }}
            className="mt-3 text-sm font-medium text-primary"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

function ProgressStep({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'done' && <CheckCircle size={20} className="text-success" />}
      {status === 'active' && <Loader2 size={20} className="animate-spin text-primary" />}
      {status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-border" />}
      <span className={`text-sm ${status === 'active' ? 'font-medium text-text' : status === 'done' ? 'text-success' : 'text-muted'}`}>
        {label}
      </span>
    </div>
  )
}
