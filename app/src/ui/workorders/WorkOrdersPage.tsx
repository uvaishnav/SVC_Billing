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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'closed'>('active')  // default: active
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
      <div style={{
        background: 'var(--topbar-bg)',
        padding: 'calc(14px + var(--safe-top)) calc(20px + var(--safe-right)) 8px calc(20px + var(--safe-left))',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(200,169,106,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-text-inverse)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Work Orders</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {workOrders.filter(wo => wo.status === 'active' || wo.status === 'expiring_soon').length} active
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleUploadClick}
              title="Upload WO PDF"
              style={{ height: '44px', padding: '0 14px', borderRadius: '22px', background: 'rgba(255,255,255,0.12)', color: 'var(--color-text-inverse)', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontFamily: 'Work Sans, sans-serif' }}
            >
              <span style={{ fontSize: '16px' }}>📎</span>
              Upload PDF
            </button>
            <button
              onClick={handleAdd}
              style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '24px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}
            >+</button>
          </div>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by WO ref, subject, client…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-text-inverse)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', marginBottom: '12px' }}
        />

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '14px', scrollbarWidth: 'none' }}>
          {statusFilters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filterStatus === f.id ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: filterStatus === f.id ? 'var(--color-accent)' : 'transparent',
                color: filterStatus === f.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                fontSize: '13px',
                fontWeight: filterStatus === f.id ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'Work Sans, sans-serif',
                flexShrink: 0,
              }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px calc(16px + var(--safe-right)) 32px calc(16px + var(--safe-left))' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading work orders…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📋</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search || filterStatus !== 'all' ? 'No work orders match your filter.' : 'No work orders yet.'}
            </p>
            {!search && filterStatus === 'all' && (
              <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add manually, or tap "Upload PDF" to extract from a work order document.</p>
            )}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {filterStatus !== 'all'
                ? `${filtered.length} ${filterStatus.replace('_', ' ')}`
                : `${filtered.length} work order${filtered.length !== 1 ? 's' : ''}`}
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
