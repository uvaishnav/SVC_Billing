import { useEffect, useState, useCallback, useRef } from 'react'
import type { WorkOrderWithClient } from '../../db/types'
import type { ParsedWorkOrder } from '../../utils/parseWorkOrder'
import { getWorkOrders, closeWorkOrder, computeWOStatus } from '../../db/workOrdersDb'
import { extractTextFromPdf, type OcrProgress } from '../../utils/ocrPdf'
import { parseWorkOrderText } from '../../utils/parseWorkOrder'
import { sectionTitleStyle } from '../settings/_components'
import WorkOrderCard from './WorkOrderCard'
import WorkOrderFormModal from './WorkOrderFormModal'
import WorkOrderDetailSheet from './WorkOrderDetailSheet'

type UploadStep = 'idle' | 'extracting' | 'parsing' | 'ready' | 'error'

function UploadProgressOverlay({ step, progress, error, onDismiss }: {
  step: UploadStep
  progress: OcrProgress | null
  error: string | null
  onDismiss: () => void
}) {
  const messages: Record<UploadStep, string> = {
    idle:       '',
    extracting: progress?.totalPages
      ? `Extracting text… page ${progress.page ?? 1} of ${progress.totalPages}`
      : 'Extracting text from PDF…',
    parsing:    'AI is parsing the work order…',
    ready:      'Done! Review the pre-filled form.',
    error:      error ?? 'Something went wrong.',
  }

  if (step === 'idle') return null

  const percent = progress?.percent ?? (step === 'parsing' ? 88 : step === 'ready' ? 100 : 10)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '24px' }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>
          {step === 'error' ? '⚠️' : step === 'ready' ? '✅' : '📄'}
        </div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif', marginBottom: '8px' }}>
          {step === 'extracting' ? 'Reading PDF' : step === 'parsing' ? 'Parsing with AI' : step === 'ready' ? 'Ready!' : 'Error'}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
          {messages[step]}
        </p>

        {(step === 'extracting' || step === 'parsing') && (
          <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', width: `${percent}%`, background: 'var(--color-accent)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {(step === 'error' || step === 'ready') && (
          <button
            type="button"
            onClick={onDismiss}
            style={{ padding: '12px 28px', borderRadius: '10px', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
          >
            {step === 'ready' ? 'Review Form' : 'Dismiss'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function WorkOrdersPage() {
  const [workOrders,   setWorkOrders]   = useState<WorkOrderWithClient[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'closed'>('active')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingWO,    setEditingWO]    = useState<WorkOrderWithClient | null>(null)
  const [detailWO,     setDetailWO]     = useState<WorkOrderWithClient | null>(null)

  // Upload flow state
  const [uploadStep,  setUploadStep]  = useState<UploadStep>('idle')
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parsedData,  setParsedData]  = useState<ParsedWorkOrder | null>(null)
  const [pendingPdf,  setPendingPdf]  = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getWorkOrders()
    const withStatus = data.map(wo => ({ ...wo, status: computeWOStatus(wo) }))
    setWorkOrders(withStatus)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = workOrders.filter(wo => {
    const matchesSearch =
      (wo.wo_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
      wo.subject.toLowerCase().includes(search.toLowerCase()) ||
      (wo.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (wo.project_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || wo.status === filterStatus
    return matchesSearch && matchesStatus
  })

  async function handleClose(id: number) {
    if (!confirm('Mark this work order as Closed? No further billing will be linked to it.')) return
    await closeWorkOrder(id)
    load()
  }

  function handleEdit(wo: WorkOrderWithClient) {
    setEditingWO(wo)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingWO(null)
    setParsedData(null)
    setPendingPdf(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingWO(null)
    setParsedData(null)
    setPendingPdf(null)
    load()
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target.files) return
    e.target.value = ''
    if (!file) return

    setPendingPdf(file)
    setUploadError(null)
    setOcrProgress(null)
    setUploadStep('extracting')

    try {
      const ocrText = await extractTextFromPdf(file, (p) => setOcrProgress(p))
      setUploadStep('parsing')
      const parsed = await parseWorkOrderText(ocrText)
      setParsedData(parsed)
      setUploadStep('ready')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setUploadError(msg)
      setUploadStep('error')
    }
  }

  function handleOverlayDismiss() {
    if (uploadStep === 'ready') {
      setEditingWO(null)
      setModalOpen(true)
    }
    setUploadStep('idle')
  }

  const statusFilters: { id: typeof filterStatus; label: string }[] = [
    { id: 'all',           label: 'All' },
    { id: 'active',        label: 'Active' },
    { id: 'expiring_soon', label: 'Expiring' },
    { id: 'expired',       label: 'Expired' },
    { id: 'closed',        label: 'Closed' },
  ]

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <UploadProgressOverlay
        step={uploadStep}
        progress={ocrProgress}
        error={uploadError}
        onDismiss={handleOverlayDismiss}
      />

      {/* Sticky header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '22px', fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif', margin: 0, marginBottom: '2px' }}>Work Orders</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontFamily: 'Work Sans, sans-serif' }}>
              {workOrders.filter(wo => wo.status === 'active').length} active · {workOrders.filter(wo => wo.status === 'expiring_soon').length} expiring
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleUploadClick}
              style={{ height: '38px', borderRadius: '10px', background: 'rgba(200,169,106,0.12)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(200,169,106,0.5)', cursor: 'pointer', padding: '0 14px', fontFamily: 'Work Sans, sans-serif', transition: 'all 150ms ease' }}
            >
              Upload PDF
            </button>
            <button
              onClick={handleAdd}
              aria-label="Add work order"
              style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--color-primary)', color: 'var(--color-bg)', fontSize: '22px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(59,42,31,0.18)', flexShrink: 0, transition: 'all 150ms ease' }}
            >+</button>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by WO ref, subject, client, or project…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px', border: '1px solid rgba(59,42,31,0.12)', background: 'rgba(255,255,255,0.85)', color: 'var(--color-text)', fontSize: '13px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(59,42,31,0.03)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
          {statusFilters.map(filter => {
            const active = filterStatus === filter.id
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setFilterStatus(filter.id)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: active ? '1px solid var(--color-primary)' : '1px solid rgba(59,42,31,0.12)',
                  background: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                  color: active ? 'var(--color-surface)' : 'var(--color-text-muted)',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  flexShrink: 0,
                  boxShadow: active ? '0 1px 4px rgba(59,42,31,0.15)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading work orders…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>🧾</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No work orders matching "${search}"` : 'No work orders yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + or Upload PDF to add your first work order.</p>}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search || filterStatus !== 'all' ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Work Orders'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(wo => (
                <WorkOrderCard
                  key={wo.id}
                  workOrder={wo}
                  onTap={setDetailWO}
                  onEdit={handleEdit}
                  onClose={handleClose}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <WorkOrderFormModal
          workOrder={editingWO}
          prefill={parsedData}
          pdfFile={pendingPdf}
          onClose={() => { setModalOpen(false); setEditingWO(null); setParsedData(null); setPendingPdf(null) }}
          onSaved={handleSaved}
        />
      )}

      {detailWO && (
        <WorkOrderDetailSheet
          workOrder={detailWO}
          onClose={() => setDetailWO(null)}
          onEdit={(wo) => { setDetailWO(null); handleEdit(wo) }}
          onRefresh={load}
        />
      )}
    </div>
  )
}
