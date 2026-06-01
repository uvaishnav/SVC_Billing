import { useState, useEffect, useRef } from 'react'
import type { WorkOrderWithClient, Client, Project } from '../../db/types'
import type { ParsedWorkOrder } from '../../utils/parseWorkOrder'
import { upsertWorkOrder, upsertWorkOrderItems, getWorkOrderItems } from '../../db/workOrdersDb'
import { supabase } from '../../db/supabaseClient'
import { uploadWorkOrderPdf } from '../../utils/uploadWorkOrderPdf'
import { Field, PrimaryButton, sectionTitleStyle } from '../settings/_components'

interface Props {
  workOrder?: WorkOrderWithClient | null
  prefill?:   ParsedWorkOrder | null
  pdfFile?:   File | null             // pre-selected PDF from the upload-parse flow
  onClose:  () => void
  onSaved:  () => void
}

const EMPTY_ITEM = { description: '', sub_work_ref: '', unit: '', contracted_qty: '', rate: '', sl_no: 0 }
type DraftItem = typeof EMPTY_ITEM

function computeValidTo(issueDate: string, durationMonths: number): string {
  const d = new Date(issueDate)
  d.setMonth(d.getMonth() + durationMonths)
  return d.toISOString().split('T')[0]
}

export default function WorkOrderFormModal({ workOrder, prefill, pdfFile: propPdfFile, onClose, onSaved }: Props) {
  const isEdit = !!workOrder

  const [clients,  setClients]  = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const p = prefill
  const [woRef,          setWoRef]          = useState(p?.wo_reference    ?? workOrder?.wo_reference    ?? '')
  const [clientId,       setClientId]       = useState<string>(workOrder?.client_id?.toString() ?? '')
  const [projectId,      setProjectId]      = useState<string>(workOrder?.project_id?.toString() ?? '')
  const [subject,        setSubject]        = useState(p?.subject          ?? workOrder?.subject          ?? '')
  const [issueDate,      setIssueDate]      = useState(p?.issue_date       ?? workOrder?.issue_date       ?? '')
  const [durationMonths, setDurationMonths] = useState(
    p?.duration_months != null ? String(p.duration_months) : (workOrder?.duration_months?.toString() ?? '15')
  )
  const [totalValue, setTotalValue] = useState(
    p?.total_value != null ? String(p.total_value) : (workOrder?.total_value?.toString() ?? '')
  )
  const [ratesFirm,     setRatesFirm]     = useState(p?.rates_firm     ?? workOrder?.rates_firm     ?? true)
  const [tdsApplicable, setTdsApplicable] = useState(p?.tds_applicable ?? workOrder?.tds_applicable ?? true)
  const [billingType,   setBillingType]   = useState(p?.billing_type   ?? workOrder?.billing_type   ?? 'monthly_ra')
  const [notes,         setNotes]         = useState(workOrder?.notes ?? '')

  // ── PDF state ──────────────────────────────────────────────────
  // selectedPdf: the File the user picked in THIS form session (overrides propPdfFile)
  // existingPdfPath: the path already stored in the DB (shown as "already attached")
  const [selectedPdf,      setSelectedPdf]      = useState<File | null>(propPdfFile ?? null)
  const [existingPdfPath,  setExistingPdfPath]  = useState<string | null>(workOrder?.original_pdf_url ?? null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // ── Items ──────────────────────────────────────────────────────
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (p?.items?.length) {
      return p.items.map((it, i) => ({
        description:    it.description,
        sub_work_ref:   it.sub_work_ref   ?? '',
        unit:           it.unit           ?? '',
        contracted_qty: it.contracted_qty != null ? String(it.contracted_qty) : '',
        rate:           String(it.rate),
        sl_no:          i + 1,
      }))
    }
    return []
  })
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft,    setEditDraft]    = useState<DraftItem>({ ...EMPTY_ITEM })
  const [draftItem,    setDraftItem]    = useState<DraftItem>({ ...EMPTY_ITEM })

  const [saving,       setSaving]       = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const hasPrefill = !!p

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClients(data ?? []))
    supabase.from('projects').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setProjects(data ?? []))
    if (isEdit && workOrder && !p) {
      getWorkOrderItems(workOrder.id).then(rows => {
        setItems(rows.map(r => ({
          description:    r.description,
          sub_work_ref:   r.sub_work_ref   ?? '',
          unit:           r.unit           ?? '',
          contracted_qty: r.contracted_qty?.toString() ?? '',
          rate:           r.rate.toString(),
          sl_no:          r.sl_no ?? 0,
        })))
      })
    }
  }, [])

  // ── Inline edit helpers ────────────────────────────────────────
  function startEditItem(index: number) { setEditingIndex(index); setEditDraft({ ...items[index] }) }
  function cancelEditItem()             { setEditingIndex(null);  setEditDraft({ ...EMPTY_ITEM }) }
  function confirmEditItem() {
    if (!editDraft.description.trim() || !editDraft.rate.trim() || isNaN(parseFloat(editDraft.rate))) return
    setItems(prev => prev.map((it, i) => i === editingIndex ? { ...editDraft, sl_no: i + 1 } : it))
    setEditingIndex(null); setEditDraft({ ...EMPTY_ITEM })
  }

  // ── Add / remove helpers ──────────────────────────────────────
  function addItem() {
    if (!draftItem.description.trim() || !draftItem.rate.trim() || isNaN(parseFloat(draftItem.rate))) return
    setItems(prev => [...prev, { ...draftItem, sl_no: prev.length + 1 }])
    setDraftItem({ ...EMPTY_ITEM })
  }
  function removeItem(index: number) {
    if (editingIndex === index) cancelEditItem()
    setItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, sl_no: i + 1 })))
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!subject.trim())   { setError('Subject is required'); return }
    if (!issueDate.trim()) { setError('Issue date is required'); return }
    if (editingIndex !== null) confirmEditItem()
    setSaving(true); setError(null)

    const duration  = durationMonths.trim() ? parseInt(durationMonths) : null
    const validTo   = duration ? computeValidTo(issueDate, duration) : null

    const saved = await upsertWorkOrder({
      id:              workOrder?.id,
      wo_reference:    woRef.trim()      || null,
      client_id:       clientId          ? parseInt(clientId)  : null,
      project_id:      projectId         ? parseInt(projectId) : null,
      subject:         subject.trim(),
      issue_date:      issueDate,
      duration_months: duration,
      valid_from:      issueDate,
      valid_to:        validTo,
      total_value:     totalValue.trim() ? parseFloat(totalValue) : null,
      rates_firm:      ratesFirm,
      tds_applicable:  tdsApplicable,
      billing_type:    billingType as any,
      notes:           notes.trim()      || null,
      status:          workOrder?.status ?? 'active',
    })

    if (!saved) { setError('Failed to save work order. Please try again.'); setSaving(false); return }

    await upsertWorkOrderItems(saved.id, items.map((it, i) => ({
      sl_no:                 i + 1,
      description:           it.description.trim(),
      sub_work_ref:          it.sub_work_ref.trim()   || null,
      unit:                  it.unit.trim()           || null,
      contracted_qty:        it.contracted_qty.trim() ? parseFloat(it.contracted_qty) : null,
      rate:                  parseFloat(it.rate),
      amount:                null,
      cumulative_billed_qty: 0,
    })))

    // Upload PDF if user selected one in this session
    const pdfToUpload = selectedPdf
    if (pdfToUpload) {
      setUploadingPdf(true)
      try {
        const pdfPath = await uploadWorkOrderPdf(pdfToUpload, saved.id)
        await supabase.from('work_orders').update({ original_pdf_url: pdfPath }).eq('id', saved.id)
      } catch (err) {
        console.error('PDF upload failed (WO saved):', err)
        setError('Work order saved, but PDF upload failed. You can retry by editing again.')
        setUploadingPdf(false)
        setSaving(false)
        return  // Don't call onSaved — let user see the error
      }
      setUploadingPdf(false)
    }

    setSaving(false)
    onSaved()
  }

  // ── Styles ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '15px', fontFamily: 'Work Sans, sans-serif',
    boxSizing: 'border-box', outline: 'none',
  }
  const smallInputStyle: React.CSSProperties = { ...inputStyle, fontSize: '13px', padding: '9px 12px' }

  const checkRow = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '15px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        style={{ width: '48px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: checked ? 'var(--color-accent)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s' }}
      >
        <span style={{ position: 'absolute', top: '3px', left: checked ? '22px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
      </button>
    </div>
  )

  const isBusy    = saving || uploadingPdf
  const saveLabel = uploadingPdf ? 'Uploading PDF…' : saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Work Order'

  // Determine PDF section display state
  const hasPdfSelected  = !!selectedPdf
  const hasExistingPdf  = !!existingPdfPath && !hasPdfSelected  // existing DB pdf, no new one chosen

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92svh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 16px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif' }}>
              {hasPrefill ? '📄 Review AI-Parsed WO' : isEdit ? 'Edit Work Order' : 'New Work Order'}
            </h2>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {hasPrefill && (
            <div style={{ background: 'rgba(212,167,90,0.1)', border: '1px solid var(--color-accent)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              ✨ <strong>Fields pre-filled by AI</strong> — review each field carefully. Tap ✏️ on any item to edit it. Client and Project must be selected manually.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(139,46,46,0.08)', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
          )}

          {/* ── Work Order Details ── */}
          <p style={sectionTitleStyle}>Work Order Details</p>
          <Field label="WO Reference" value={woRef} onChange={setWoRef} placeholder="e.g. LC-14, LC-150" />

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Project (optional)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
              <option value="">— No project —</option>
              {projects.map(proj => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Subject *</label>
            <textarea value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Full subject / description from the work order document…"
              rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Issue Date *" value={issueDate} onChange={setIssueDate} type="date" />
            <Field label="Duration (months)" value={durationMonths} onChange={setDurationMonths} placeholder="e.g. 15" type="number" />
          </div>
          <Field label="Total Contract Value (₹)" value={totalValue} onChange={setTotalValue} placeholder="e.g. 17425000" type="number" />

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Billing Type</label>
            <select value={billingType} onChange={e => setBillingType(e.target.value)} style={inputStyle}>
              <option value="monthly_ra">Monthly RA Bills</option>
              <option value="milestone">Milestone</option>
              <option value="adhoc">Ad-hoc</option>
            </select>
          </div>

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>Terms & Conditions</p>
          {checkRow('Rates are firm (no escalation)', ratesFirm, setRatesFirm)}
          {checkRow('TDS applicable', tdsApplicable, setTdsApplicable)}

          {/* ── Work Order Items ── */}
          <p style={{ ...sectionTitleStyle, marginTop: '20px' }}>Work Order Items</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '14px', lineHeight: 1.5 }}>
            {hasPrefill && items.length > 0
              ? `${items.length} item${items.length !== 1 ? 's' : ''} extracted by AI — tap ✏️ to edit any item.`
              : 'Add each line item from the work order table.'}
          </p>

          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {items.map((item, i) => (
                <div key={i} style={{
                  background: 'var(--color-surface)', borderRadius: '10px',
                  border: editingIndex === i ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                  overflow: 'hidden',
                }}>
                  {editingIndex === i ? (
                    <div style={{ padding: '14px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Editing Item {i + 1}</p>
                      <div style={{ marginBottom: '8px' }}>
                        <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                          placeholder="Description *" rows={2} style={{ ...inputStyle, resize: 'none', fontSize: '14px', lineHeight: 1.4 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input value={editDraft.sub_work_ref}   onChange={e => setEditDraft(d => ({ ...d, sub_work_ref: e.target.value }))}   placeholder="Sub-work ref" style={smallInputStyle} />
                        <input value={editDraft.unit}           onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))}           placeholder="Unit"         style={smallInputStyle} />
                        <input value={editDraft.contracted_qty} onChange={e => setEditDraft(d => ({ ...d, contracted_qty: e.target.value }))} placeholder="Contracted Qty" type="number" style={smallInputStyle} />
                        <input value={editDraft.rate}           onChange={e => setEditDraft(d => ({ ...d, rate: e.target.value }))}           placeholder="Rate (₹) *"  type="number" style={smallInputStyle} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={confirmEditItem}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>✔ Confirm</button>
                        <button type="button" onClick={cancelEditItem}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>✕ Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>
                          {i + 1}. {item.description}
                          {item.sub_work_ref && <span style={{ fontSize: '12px', color: 'var(--color-accent)', marginLeft: '6px' }}>[{item.sub_work_ref}]</span>}
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                          {item.unit           && `${item.unit} · `}
                          {item.contracted_qty  && `Qty: ${item.contracted_qty} · `}
                          Rate: ₹{parseFloat(item.rate).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button type="button" onClick={() => startEditItem(i)} title="Edit item"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                        <button type="button" onClick={() => removeItem(i)} title="Remove item"
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'none', color: 'var(--color-error)', border: 'none', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new item */}
          <div style={{ background: 'var(--color-surface-offset)', borderRadius: '12px', padding: '16px', border: '1px dashed var(--color-border)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '12px', fontFamily: 'Work Sans, sans-serif' }}>Add Item</p>
            <div style={{ marginBottom: '10px' }}>
              <textarea value={draftItem.description} onChange={e => setDraftItem(d => ({ ...d, description: e.target.value }))}
                placeholder="Description *" rows={2} style={{ ...inputStyle, resize: 'none', fontSize: '14px', lineHeight: 1.4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <input value={draftItem.sub_work_ref}   onChange={e => setDraftItem(d => ({ ...d, sub_work_ref: e.target.value }))}   placeholder="Sub-work ref (e.g. SW:1)" style={smallInputStyle} />
              <input value={draftItem.unit}           onChange={e => setDraftItem(d => ({ ...d, unit: e.target.value }))}           placeholder="Unit (MT, CUM, Month)"   style={smallInputStyle} />
              <input value={draftItem.contracted_qty} onChange={e => setDraftItem(d => ({ ...d, contracted_qty: e.target.value }))} placeholder="Contracted Qty" type="number" style={smallInputStyle} />
              <input value={draftItem.rate}           onChange={e => setDraftItem(d => ({ ...d, rate: e.target.value }))}           placeholder="Rate (₹) *"    type="number" style={smallInputStyle} />
            </div>
            <button type="button" onClick={addItem}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
            >+ Add Item</button>
          </div>

          {/* ── Notes ── */}
          <p style={{ ...sectionTitleStyle, marginTop: '20px' }}>Notes</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes…" rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />

          {/* ── Original Document (PDF) ── */}
          <p style={{ ...sectionTitleStyle, marginTop: '20px' }}>Original Document</p>

          {/* Hidden file input */}
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              setSelectedPdf(f)
              e.target.value = ''
            }}
          />

          <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)' }}>
            {hasPdfSelected ? (
              // New file chosen — ready to upload on save
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '22px' }}>📄</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPdf!.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                      {(selectedPdf!.size / 1024).toFixed(0)} KB · Will upload on save
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPdf(null)}
                  style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', flexShrink: 0 }}>✕</button>
              </div>
            ) : hasExistingPdf ? (
              // PDF already attached in DB
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '22px' }}>📎</span>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>PDF attached</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>{existingPdfPath}</p>
                  </div>
                </div>
                <button type="button" onClick={() => pdfInputRef.current?.click()}
                  style={{ padding: '7px 14px', borderRadius: '8px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif', flexShrink: 0 }}
                >Replace</button>
              </div>
            ) : (
              // No PDF yet
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>No PDF attached yet</p>
                <button type="button" onClick={() => pdfInputRef.current?.click()}
                  style={{ padding: '10px 24px', borderRadius: '10px', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
                >📎 Attach PDF</button>
              </div>
            )}
          </div>

        </div>{/* end body */}

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Cancel</button>
          <PrimaryButton onClick={handleSave} disabled={isBusy}>{saveLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
