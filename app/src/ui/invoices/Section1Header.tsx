// Wizard Section 1: Invoice Header
// Client, GSTIN, invoice date, billing period, WO ref, SAC, bank account
import React, { useEffect, useState } from 'react'
import type { InvoiceDraft, ClientWithGstins, WorkOrder, SacCode, BankAccount, TaxMode } from '../../db/types'
import { getClients } from '../../db/clientsDb'
import { getWorkOrdersByClient } from '../../db/workOrdersDb'
import { getSettings, getSacCodes, getBankAccounts } from '../../db/settingsDb'
import { generateInvoiceNumber } from '../../utils/invoiceNumbering'
import { inputStyle, labelStyle, cardStyle } from '../settings/_components'

const FIELD = ({
  label, children, required,
}: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={labelStyle}>
      {label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>}
    </label>
    {children}
  </div>
)

const Select = ({
  value, onChange, children, disabled,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    style={{ ...inputStyle, appearance: 'none', backgroundImage: 'none' }}
  >
    {children}
  </select>
)

export default function Section1Header({
  draft, patch,
}: {
  draft: InvoiceDraft
  patch: (u: Partial<InvoiceDraft>) => void
}) {
  const [clients, setClients]         = useState<ClientWithGstins[]>([])
  const [workOrders, setWorkOrders]   = useState<WorkOrder[]>([])
  const [sacCodes, setSacCodes]       = useState<SacCode[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [myStateCode, setMyStateCode] = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const [cls, sacs, banks, settings] = await Promise.all([
        getClients(),
        getSacCodes(),
        getBankAccounts(),
        getSettings(),
      ])
      setClients(cls)
      setSacCodes(sacs.filter(s => s.is_active))
      setBankAccounts(banks.filter(b => b.is_active))
      setMyStateCode(settings?.state_code ?? '')

      // Pre-fill defaults if draft is fresh
      if (!draft.invoice_number) {
        const invNum = await generateInvoiceNumber()
        patch({
          invoice_number:     invNum ?? '',
          sac_id:             draft.sac_id  ?? settings?.default_sac_id  ?? null,
          bank_account_id:    draft.bank_account_id ?? settings?.default_bank_account_id ?? null,
          tds_rate:           settings?.tds_applicable ? settings.default_tds_rate : 0,
          reverse_charge:     settings?.reverse_charge_applicable ?? false,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  // When client changes, load their WOs + update tax mode
  useEffect(() => {
    if (!draft.client_id) { setWorkOrders([]); return }
    getWorkOrdersByClient(draft.client_id).then(wos => {
      setWorkOrders(wos.filter(wo => wo.status !== 'closed'))
    })
    // Determine tax mode from selected GSTIN
    const client = clients.find(c => c.id === draft.client_id)
    const gstin  = client?.gstins.find(g => g.id === draft.client_gstin_id)
    if (gstin && myStateCode) {
      const taxMode: TaxMode = gstin.state_code === myStateCode ? 'cgst_sgst' : 'igst'
      patch({
        tax_mode:             taxMode,
        place_of_supply:      gstin.state,
        place_of_supply_code: gstin.state_code,
      })
    }
  }, [draft.client_id, draft.client_gstin_id, clients, myStateCode])

  const selectedClient = clients.find(c => c.id === draft.client_id)

  if (loading) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ padding: '16px' }}>

      {/* Invoice Number — read only */}
      <div style={{ ...cardStyle, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Number</span>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: 'var(--color-accent)', fontWeight: 700 }}>
          {draft.invoice_number || '...'}
        </span>
      </div>

      {/* Client */}
      <FIELD label="Client" required>
        <Select value={String(draft.client_id ?? '')} onChange={v => patch({ client_id: Number(v) || null, client_gstin_id: null, work_order_id: null })}>
          <option value="">Select client...</option>
          {clients.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </FIELD>

      {/* Client GSTIN */}
      {selectedClient && (
        <FIELD label="Client GSTIN" required>
          <Select
            value={String(draft.client_gstin_id ?? '')}
            onChange={v => patch({ client_gstin_id: Number(v) || null })}
          >
            <option value="">Select GSTIN...</option>
            {selectedClient.gstins.map(g => (
              <option key={g.id} value={g.id}>
                {g.gstin} — {g.state}
              </option>
            ))}
          </Select>
          {/* Tax mode badge */}
          {draft.client_gstin_id && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                background: draft.tax_mode === 'igst' ? 'var(--color-info)' : 'var(--color-success)',
                color: '#fff',
              }}>
                {draft.tax_mode === 'igst' ? 'IGST' : 'CGST + SGST'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                {draft.place_of_supply} ({draft.place_of_supply_code})
              </span>
            </div>
          )}
        </FIELD>
      )}

      {/* Invoice Date */}
      <FIELD label="Invoice Date" required>
        <input
          type="date" value={draft.invoice_date}
          onChange={e => patch({ invoice_date: e.target.value })}
          style={inputStyle}
        />
      </FIELD>

      {/* Billing Period */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Billing From<span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span></label>
          <input type="date" value={draft.billing_from}
            onChange={e => patch({ billing_from: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Billing To<span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span></label>
          <input type="date" value={draft.billing_to}
            onChange={e => patch({ billing_to: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Work Order */}
      <FIELD label="Work Order (optional)">
        <Select value={String(draft.work_order_id ?? '')} onChange={v => patch({ work_order_id: Number(v) || null })} disabled={!draft.client_id}>
          <option value="">No work order linked</option>
          {workOrders.map(wo => (
            <option key={wo.id} value={wo.id}>
              {wo.wo_reference ? `${wo.wo_reference} — ` : ''}{wo.subject.slice(0, 40)}
            </option>
          ))}
        </Select>
      </FIELD>

      {/* SAC Code */}
      <FIELD label="SAC Code" required>
        <Select value={String(draft.sac_id ?? '')} onChange={v => patch({ sac_id: Number(v) || null })}>
          <option value="">Select SAC code...</option>
          {sacCodes.map(s => (
            <option key={s.id} value={s.id}>{s.sac_code} — {s.nickname}</option>
          ))}
        </Select>
      </FIELD>

      {/* Bank Account */}
      <FIELD label="Bank Account" required>
        <Select value={String(draft.bank_account_id ?? '')} onChange={v => patch({ bank_account_id: Number(v) || null })}>
          <option value="">Select bank account...</option>
          {bankAccounts.map(b => (
            <option key={b.id} value={b.id}>{b.nickname} — {b.account_number}</option>
          ))}
        </Select>
      </FIELD>

    </div>
  )
}
