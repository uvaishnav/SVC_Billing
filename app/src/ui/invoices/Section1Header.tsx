import React, { useEffect, useState } from 'react'
import type { InvoiceDraft, Client, ClientGstin, WorkOrder, SacCode, BankAccount, Settings } from '../../db/types'
import { detectTaxMode } from '../../db/invoicesDb'

// Prev month default billing period
function prevMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to   = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt  = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(from), to: fmt(to) }
}

interface Props {
  draft: InvoiceDraft
  settings: Settings
  clients: Client[]
  clientGstins: ClientGstin[]
  workOrders: WorkOrder[]
  sacCodes: SacCode[]
  bankAccounts: BankAccount[]
  onLoadGstins: (clientId: number) => void
  onLoadWorkOrders: (clientId: number) => void
  onChange: (patch: Partial<InvoiceDraft>) => void
  onNext: () => void
}

const field: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px',
}
const label: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--color-text-faint)',
  fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase',
}
const input: React.CSSProperties = {
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(200,169,106,0.2)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '14px',
  fontFamily: 'Work Sans, sans-serif',
  width: '100%',
  boxSizing: 'border-box',
}
const readonlyBadge: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(200,169,106,0.1)',
  borderRadius: '8px',
  color: 'var(--color-text-faint)',
  fontSize: '13px',
  fontFamily: 'Work Sans, sans-serif',
}

export default function Section1Header({
  draft, settings, clients, clientGstins, workOrders,
  sacCodes, bankAccounts, onLoadGstins, onLoadWorkOrders, onChange, onNext,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const { from: prevFrom, to: prevTo } = prevMonthRange()

  // Init defaults on mount
  useEffect(() => {
    const patch: Partial<InvoiceDraft> = {}
    if (!draft.invoice_date)  patch.invoice_date  = today
    if (!draft.billing_from)  patch.billing_from  = prevFrom
    if (!draft.billing_to)    patch.billing_to    = prevTo
    if (!draft.sac_id && settings.default_sac_id)              patch.sac_id         = settings.default_sac_id
    if (!draft.bank_account_id && settings.default_bank_account_id) patch.bank_account_id = settings.default_bank_account_id
    if (Object.keys(patch).length > 0) onChange(patch)
  }, [])

  // Auto-detect tax mode when client GSTIN changes
  function handleGstinChange(gstinId: number) {
    const gstin = clientGstins.find(g => g.id === gstinId)
    if (!gstin) return
    const taxMode = detectTaxMode(gstin.state_code, settings.state_code)
    onChange({ client_gstin_id: gstinId, tax_mode: taxMode })
  }

  function handleClientChange(clientId: number) {
    onChange({ client_id: clientId, client_gstin_id: null, work_order_id: null, tax_mode: 'cgst_sgst' })
    onLoadGstins(clientId)
    onLoadWorkOrders(clientId)
  }

  const isValid = !!(draft.client_id && draft.client_gstin_id && draft.invoice_date &&
    draft.billing_from && draft.billing_to && draft.sac_id && draft.bank_account_id)

  const taxModeLabel = draft.tax_mode === 'igst' ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Invoice Number */}
      <div style={field}>
        <span style={label}>Invoice Number</span>
        <div style={readonlyBadge}>{draft.invoice_number || 'Generating…'}</div>
      </div>

      {/* Client */}
      <div style={field}>
        <span style={label}>Client *</span>
        <select
          style={input}
          value={draft.client_id ?? ''}
          onChange={e => handleClientChange(Number(e.target.value))}
        >
          <option value=''>Select client…</option>
          {clients.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Client GSTIN */}
      {draft.client_id && (
        <div style={field}>
          <span style={label}>Bill To (GSTIN) *</span>
          <select
            style={input}
            value={draft.client_gstin_id ?? ''}
            onChange={e => handleGstinChange(Number(e.target.value))}
          >
            <option value=''>Select GSTIN…</option>
            {clientGstins.map(g => (
              <option key={g.id} value={g.id}>
                {g.gstin} — {g.state}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tax Mode Badge */}
      {draft.client_gstin_id && (
        <div style={field}>
          <span style={label}>Tax Mode (auto-detected)</span>
          <div style={{
            ...readonlyBadge,
            color: draft.tax_mode === 'igst' ? '#f59e0b' : '#22c55e',
            borderColor: draft.tax_mode === 'igst' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)',
          }}>⚡ {taxModeLabel}</div>
        </div>
      )}

      {/* Invoice Date */}
      <div style={field}>
        <span style={label}>Invoice Date *</span>
        <input type='date' style={input} value={draft.invoice_date}
          onChange={e => onChange({ invoice_date: e.target.value })} />
      </div>

      {/* Billing Period */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={field}>
          <span style={label}>Billing From *</span>
          <input type='date' style={input} value={draft.billing_from}
            onChange={e => onChange({ billing_from: e.target.value })} />
        </div>
        <div style={field}>
          <span style={label}>Billing To *</span>
          <input type='date' style={input} value={draft.billing_to}
            onChange={e => onChange({ billing_to: e.target.value })} />
        </div>
      </div>

      {/* Work Order */}
      <div style={field}>
        <span style={label}>Work Order Reference (optional)</span>
        <select
          style={input}
          value={draft.work_order_id ?? ''}
          onChange={e => onChange({ work_order_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value=''>None / Ad-hoc invoice</option>
          {workOrders.filter(wo => wo.status !== 'closed').map(wo => (
            <option key={wo.id} value={wo.id}>
              {wo.wo_reference ? `${wo.wo_reference} — ` : ''}{wo.subject}
            </option>
          ))}
        </select>
      </div>

      {/* SAC Code */}
      <div style={field}>
        <span style={label}>SAC Code *</span>
        <select
          style={input}
          value={draft.sac_id ?? ''}
          onChange={e => onChange({ sac_id: Number(e.target.value) })}
        >
          <option value=''>Select SAC…</option>
          {sacCodes.filter(s => s.is_active).map(s => (
            <option key={s.id} value={s.id}>{s.sac_code} — {s.nickname}</option>
          ))}
        </select>
      </div>

      {/* Bank Account */}
      <div style={field}>
        <span style={label}>Bank Account *</span>
        <select
          style={input}
          value={draft.bank_account_id ?? ''}
          onChange={e => onChange({ bank_account_id: Number(e.target.value) })}
        >
          <option value=''>Select bank…</option>
          {bankAccounts.filter(b => b.is_active).map(b => (
            <option key={b.id} value={b.id}>{b.nickname} — {b.bank_name}</option>
          ))}
        </select>
      </div>

      {/* Next */}
      <button
        onClick={onNext}
        disabled={!isValid}
        style={{
          padding: '14px',
          background: isValid ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
          color: isValid ? 'var(--color-primary)' : 'var(--color-text-faint)',
          border: 'none', borderRadius: '10px',
          fontSize: '15px', fontWeight: 700,
          fontFamily: 'Work Sans, sans-serif',
          cursor: isValid ? 'pointer' : 'default',
          marginTop: '8px',
        }}
      >
        Next → Work Items
      </button>
    </div>
  )
}
