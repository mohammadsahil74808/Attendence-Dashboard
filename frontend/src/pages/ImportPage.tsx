import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Upload, FileSpreadsheet, CheckCircle2, ArrowRight,
  ArrowLeft, Check
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { useToast } from '../contexts/ToastContext'
import api from '../lib/api'
import type { ImportPreview, User } from '../types'

const TARGET_FIELDS = [
  { value: 'ignore', label: '— Ignore Column —' },
  { value: 'name', label: 'Name (Required)' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'whatsapp', label: 'WhatsApp Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'organization', label: 'Organization / College' },
  { value: 'designation', label: 'Designation / Role' },
  { value: 'city', label: 'City / Location' },
  { value: 'source', label: 'Source / Campaign' },
  { value: 'notes', label: 'Notes' },
]

export default function ImportPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreview | null>(null)
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [duplicateActions, setDuplicateActions] = useState<Record<number, 'skip' | 'update' | 'import_new'>>({})
  const [assignedToId, setAssignedToId] = useState<number | undefined>(undefined)
  const [commitResult, setCommitResult] = useState<any | null>(null)

  // Fetch users for batch assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users/')
      return res.data
    },
  })

  // Upload Preview Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data: ImportPreview) => {
      setPreviewData(data)
      // Auto-suggest column mappings
      const initialMappings: Record<string, string> = {}
      data.columns.forEach((col) => {
        const lower = col.toLowerCase().trim()
        if (lower.includes('name')) initialMappings[col] = 'name'
        else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) initialMappings[col] = 'phone'
        else if (lower.includes('whatsapp')) initialMappings[col] = 'whatsapp'
        else if (lower.includes('mail')) initialMappings[col] = 'email'
        else if (lower.includes('org') || lower.includes('company') || lower.includes('college')) initialMappings[col] = 'organization'
        else if (lower.includes('desig') || lower.includes('role')) initialMappings[col] = 'designation'
        else if (lower.includes('city') || lower.includes('location')) initialMappings[col] = 'city'
        else if (lower.includes('source')) initialMappings[col] = 'source'
        else if (lower.includes('note') || lower.includes('comment')) initialMappings[col] = 'notes'
        else initialMappings[col] = 'ignore'
      })
      setColumnMappings(initialMappings)

      // Set default duplicate actions to "skip"
      const initialActions: Record<number, 'skip' | 'update' | 'import_new'> = {}
      data.preview_rows.forEach((row) => {
        if (row.duplicate_match) {
          initialActions[row.row_index] = 'skip'
        }
      })
      setDuplicateActions(initialActions)

      setStep(2)
      toast.show('File uploaded and parsed successfully', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to parse file'
      toast.show(msg, 'error')
    },
  })

  // Commit Import Mutation
  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) return
      const mappingsPayload = Object.entries(columnMappings)
        .filter(([_, target]) => target !== 'ignore')
        .map(([source_column, target_field]) => ({ source_column, target_field }))

      const res = await api.post('/import/commit', {
        batch_id: previewData.batch_id,
        column_mappings: mappingsPayload,
        duplicate_actions: duplicateActions,
        assigned_to_id: assignedToId || null,
      })
      return res.data
    },
    onSuccess: (data) => {
      setCommitResult(data)
      setStep(4)
      toast.show('Contacts successfully imported!', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to commit import'
      toast.show(msg, 'error')
    },
  })

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  function handleUpload() {
    if (!selectedFile) return
    uploadMutation.mutate(selectedFile)
  }

  return (
    <AppLayout requireAdmin>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Import Contacts Wizard"
          subtitle="Upload and map Excel (.xlsx) or CSV files into the system with automated duplicate detection"
        />

        {/* Wizard Stepper */}
        <div className="flex items-center justify-between panel p-4 text-xs font-medium">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-400 font-semibold' : 'text-neutral-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-neutral-800'}`}>
              1
            </span>
            Upload File
          </div>
          <div className="w-8 h-px bg-neutral-800" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-400 font-semibold' : 'text-neutral-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-neutral-800'}`}>
              2
            </span>
            Map Columns
          </div>
          <div className="w-8 h-px bg-neutral-800" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-400 font-semibold' : 'text-neutral-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-neutral-800'}`}>
              3
            </span>
            Review & Duplicates
          </div>
          <div className="w-8 h-px bg-neutral-800" />
          <div className={`flex items-center gap-2 ${step === 4 ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 4 ? 'bg-emerald-600 text-white' : 'bg-neutral-800'}`}>
              4
            </span>
            Complete
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="panel p-8 space-y-6 text-center">
            <div className="border-2 border-dashed border-neutral-700 rounded-lg p-10 hover:border-indigo-500 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-neutral-200">Select Excel or CSV Spreadsheet</h3>
              <p className="text-xs text-neutral-400 mt-1 mb-4">
                Supported formats: .xlsx, .csv (Max 20MB)
              </p>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Browse Files
              </label>

              {selectedFile && (
                <div className="mt-4 p-3 bg-neutral-900 rounded border border-neutral-800 inline-block text-xs text-neutral-300">
                  Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="btn-primary inline-flex items-center gap-2 text-xs"
              >
                {uploadMutation.isPending ? 'Processing File...' : 'Upload & Preview'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && previewData && (
          <div className="panel p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-neutral-100">Column Mapping</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Match each column from <strong className="text-neutral-200">{previewData.filename}</strong> to the system contact fields.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-neutral-800 text-xs font-semibold text-neutral-400">
                <span>File Header Column</span>
                <span>System Field</span>
              </div>

              {previewData.columns.map((col) => (
                <div key={col} className="grid grid-cols-2 gap-4 items-center py-1.5 border-b border-neutral-900">
                  <span className="text-xs font-mono text-neutral-200">{col}</span>
                  <select
                    value={columnMappings[col] || 'ignore'}
                    onChange={(e) => setColumnMappings({ ...columnMappings, [col]: e.target.value })}
                    className="input-select text-xs"
                  >
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4">
              <button onClick={() => setStep(1)} className="btn-secondary text-xs inline-flex items-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button onClick={() => setStep(3)} className="btn-primary text-xs inline-flex items-center gap-2">
                Review & Duplicates <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Duplicates */}
        {step === 3 && previewData && (
          <div className="panel p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-100">Pre-Import Validation & Duplicate Resolution</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Total rows: <strong className="text-neutral-200">{previewData.total_rows}</strong> |
                  Duplicates detected: <strong className="text-amber-400">{previewData.duplicate_count}</strong> |
                  Validation errors: <strong className="text-rose-400">{previewData.error_count}</strong>
                </p>
              </div>
            </div>

            {/* Optional batch assignment */}
            <div className="p-4 bg-neutral-900/60 rounded border border-neutral-800 space-y-2">
              <label className="text-xs font-medium text-neutral-300 block">
                Assign all newly imported contacts to an operator (Optional):
              </label>
              <select
                value={assignedToId || ''}
                onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : undefined)}
                className="input-select text-xs w-full max-w-xs"
              >
                <option value="">Leave Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Duplicate Rows List */}
            {previewData.duplicate_count > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Duplicate Rows ({previewData.duplicate_count})
                </h4>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {previewData.preview_rows
                    .filter((r) => r.duplicate_match)
                    .map((row) => (
                      <div key={row.row_index} className="p-3 bg-neutral-900/80 rounded border border-amber-500/20 text-xs flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-neutral-200">
                            Row #{row.row_index + 1}: {row.data['name'] || Object.values(row.data)[0]}
                          </span>
                          <p className="text-neutral-400 text-2xs">
                            Matches existing contact: <strong>{row.duplicate_match?.name}</strong> (#{row.duplicate_match?.id})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={duplicateActions[row.row_index] || 'skip'}
                            onChange={(e) => setDuplicateActions({
                              ...duplicateActions,
                              [row.row_index]: e.target.value as 'skip' | 'update' | 'import_new',
                            })}
                            className="input-select text-xs"
                          >
                            <option value="skip">Skip Row</option>
                            <option value="update">Update Existing</option>
                            <option value="import_new">Import as Duplicate</option>
                          </select>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button onClick={() => setStep(2)} className="btn-secondary text-xs inline-flex items-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending}
                className="btn-primary text-xs inline-flex items-center gap-2"
              >
                {commitMutation.isPending ? 'Importing Batch...' : 'Commit Import'}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && commitResult && (
          <div className="panel p-8 text-center space-y-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-neutral-100">Import Batch Completed</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Batch #{commitResult.id} from <strong>{commitResult.filename}</strong> has been imported.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-center">
              <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                <span className="text-xs text-neutral-400 block">Total Rows</span>
                <span className="text-base font-bold text-neutral-100 font-mono">{commitResult.row_count}</span>
              </div>
              <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                <span className="text-xs text-emerald-400 block">Successful</span>
                <span className="text-base font-bold text-emerald-400 font-mono">{commitResult.success_count}</span>
              </div>
              <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                <span className="text-xs text-rose-400 block">Errors / Skipped</span>
                <span className="text-base font-bold text-rose-400 font-mono">{commitResult.error_count}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => navigate(`/contacts?import_batch_id=${commitResult.id}`)}
                className="btn-primary text-xs inline-flex items-center gap-2"
              >
                View Imported Contacts <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setStep(1)
                  setSelectedFile(null)
                  setPreviewData(null)
                }}
                className="btn-secondary text-xs"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
