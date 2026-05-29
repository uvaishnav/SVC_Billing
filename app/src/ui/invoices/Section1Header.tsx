// Wizard Section 1: Invoice Header
// Invoice number is NOT generated here.
// It is assigned at finalize time in Section4Review / invoicesDb.
import React, { useEffect, useState } from 'react'
import type { InvoiceDraft, ClientWithGstins, WorkOrder, SacCode, BankAccount, TaxMode, InvoiceBillingType } from '../../db/types'
import { getClients } from '../../db/clientsDb'
import { getWorkOrders } from '../../db/workOrdersDb'
import { getSettings, getSacCodes, getBankAccounts } from '../../db/settingsDb'
import { inputStyle, labelStyle } from '../settings/_components'

// ─── Helpers ──────────────────────────────────────────────────

// IMPORTANT: always use this instead of new Date(isoString) for display.
// new Date("2026-03-01") parses as UTC midnight, which in IST (UTC+5:30)
// becomes 28 Feb 11:30 PM — showing the wrong date in the pill.
function formatISODate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`
}

// ─── Local primitives ─────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '1px',
      textTransform: 'uppercase', color: 'var(--color-text-faint)',
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-border)', margin: '20px 0' }} />
}

function FieldWrap({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function StyledSelect({
  value, onChange, children, disabled,
}: {
  value: string; onChange: (v: string) => void
  children: React.ReactNode; disabled?: boolean
}) {
  const [focused, setFocused] = React.useState(false)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? 'var(--color-accent)' : 'var(--color-border)',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A6A58' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px center',
        paddingRight: 36,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {children}
    </select>
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = React.useState(false)
  return (
    <input
      type="date" value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? 'var(--color-accent)' : 'var(--color-border)',
        transition: 'border-color 0.15s',
      }}
    />
  )
}

// ─── Billing type segmented toggle ────────────────────────────

const BILLING_TYPES: { value: InvoiceBillingType; label: string; icon: string; hint: string }[] = [
  {
    value: 'quantity',
    label: 'Per Quantity',
    icon: '📦',
    hint: 'Bill by unit × rate (trips, hours, loads)',
  },
  {
    value: 'rental',
    label: 'Monthly Rental',
    icon: '🚛',
    hint: 'Full month or partial days at fixed monthly rent',
  },
]

function BillingTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: InvoiceBillingType
  onChange: (v: InvoiceBillingType) => void
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {BILLING_TYPES.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12, textAlign: 'left',
              border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: active ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'border-color 0.15s, background 0.15s',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 22 }}>{opt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                color: active ? 'var(--color-primary)' : 'var(--color-text)',
              }}>
                {opt.label}
              </div>
              <div style={{
                fontSize: 12,
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                marginTop: 2,
                opacity: active ? 0.85 : 0.7,
              }}>
                {opt.hint}
              </div>
            </div>
            {active && (
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function Section1Header({
  draft, patch,
}: {
  draft: InvoiceDraft
  patch: (u: Partial<InvoiceDraft>) => void
}) {
  const [clients, setClients]           = useState<ClientWithGstins[]>([])
  const [workOrders, setWorkOrders]     = useState<WorkOrder[]>([])
  const [sacCodes, setSacCodes]         = useState<SacCode[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [myStateCode, setMyStateCode]   = useState('')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      const [cls, sacs, banks, settings] = await Promise.all([
        getClients(), getSacCodes(), getBankAccounts(), getSettings(),
      ])
      setClients(cls)
      setSacCodes(sacs.filter(s => s.is_active))
      setBankAccounts(banks.filter(b => b.is_active))
      setMyStateCode(settings?.state_code ?? '')

      const updates: Partial<InvoiceDraft> = {}
      if (!draft.sac_id          && settings?.default_sac_id)          updates.sac_id          = settings.default_sac_id
      if (!draft.bank_account_id && settings?.default_bank_account_id) updates.bank_account_id = settings.default_bank_account_id
      if (draft.tds_rate     === undefined) updates.tds_rate     = settings?.tds_applicable ? (settings.default_tds_rate ?? 0) : 0
      if (draft.reverse_charge === undefined) updates.reverse_charge = settings?.reverse_charge_applicable ?? false
      if (Object.keys(updates).length > 0) patch(updates)

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!draft.client_id) { setWorkOrders([]); return }
    getWorkOrders().then(wos => {
      setWorkOrders(wos.filter(wo => wo.client_id === draft.client_id && wo.status !== 'closed'))
    })
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
  const selectedBank   = bankAccounts.find(b => b.id === draft.bank_account_id)
  const isLocked       = !!draft.invoice_number && !draft.invoice_number.startsWith('DRAFT') && draft.invoice_number !== 'DRAFT'

  // When switching billing type, clear the opposing data arrays so
  // totals don't bleed across modes. Show a confirmation if data exists.
  function handleBillingTypeChange(newType: InvoiceBillingType) {
    if (newType === draft.line_item_billing_type) return

    const hasQuantityData = draft.line_items.length > 0
    const hasRentalData   = draft.rental_items.length > 0

    if (
      (newType === 'rental'   && hasQuantityData) ||
      (newType === 'quantity' && hasRentalData)
    ) {
      const ok = window.confirm(
        `Switching billing type will clear the ${newType === 'rental' ? 'quantity line items' : 'rental vehicle rows'} you have entered. Continue?`
      )
      if (!ok) return
    }

    patch({
      line_item_billing_type: newType,
      // Clear the opposing arrays so totals are clean
      line_items:         newType === 'rental'   ? [] : draft.line_items,
      rental_items:       newType === 'quantity' ? [] : draft.rental_items,
      item_distribution:  newType === 'quantity' ? [] : draft.item_distribution,
    })
  }

  if (loading) return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <p style={{ color: 'var(--color-text-faint)', fontSize: 15 }}>Loading invoice data…</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: 120 }}>

      {/* Invoice number banner */}
      <div style={{
        background: 'var(--color-primary)',
        padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: 'rgba(245,241,232,0.5)',
        }}>Invoice Number</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLocked && <span style={{ fontSize: 11, color: 'var(--color-accent)', opacity: 0.6 }}>🔒</span>}
          <span style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: isLocked ? 20 : 15, fontWeight: 700,
            color: isLocked ? 'var(--color-accent)' : 'rgba(245,241,232,0.35)',
            fontStyle: isLocked ? 'normal' : 'italic',
          }}>
            {isLocked ? draft.invoice_number : 'Assigned on Finalize'}
          </span>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* ───── CLIENT DETAILS ───── */}
        <SectionLabel>Client Details</SectionLabel>

        <FieldWrap label="Client" required>
          <StyledSelect
            value={String(draft.client_id ?? '')}
            onChange={v => patch({ client_id: Number(v) || null, client_gstin_id: null, work_order_id: null })}
          >
            <option value="">Select client…</option>
            {clients.filter(c => c.is_active).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </StyledSelect>
        </FieldWrap>

        {selectedClient && (
          <FieldWrap label="Billing GSTIN" required>
            <StyledSelect
              value={String(draft.client_gstin_id ?? '')}
              onChange={v => patch({ client_gstin_id: Number(v) || null })}
            >
              <option value="">Select GSTIN…</option>
              {selectedClient.gstins.map(g => (
                <option key={g.id} value={g.id}>{g.gstin} — {g.state}</option>
              ))}
            </StyledSelect>

            {draft.client_gstin_id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{
                  padding: '4px 12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700,
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
          </FieldWrap>
        )}

        <Divider />

        {/* ───── INVOICE PERIOD ───── */}
        <SectionLabel>Invoice Period</SectionLabel>

        <FieldWrap label="Invoice Date" required>
          <DateInput value={draft.invoice_date} onChange={v => patch({ invoice_date: v })} />
        </FieldWrap>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>From <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <DateInput value={draft.billing_from} onChange={v => patch({ billing_from: v })} />
          </div>
          <div>
            <label style={labelStyle}>To <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <DateInput value={draft.billing_to} onChange={v => patch({ billing_to: v })} />
          </div>
        </div>

        {/* Billing period pill — uses formatISODate to avoid UTC→IST timezone shift */}
        {draft.billing_from && draft.billing_to && (
          <div style={{
            background: 'var(--color-surface-offset)',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, color: 'var(--color-text-muted)',
            marginBottom: 6, textAlign: 'center',
          }}>
            📅 {formatISODate(draft.billing_from)} → {formatISODate(draft.billing_to)}
          </div>
        )}

        <Divider />

        {/* ───── WORK ORDER ───── */}
        <SectionLabel>Work Order (Optional)</SectionLabel>

        <FieldWrap label="Linked Work Order">
          <StyledSelect
            value={String(draft.work_order_id ?? '')}
            onChange={v => patch({ work_order_id: Number(v) || null })}
            disabled={!draft.client_id}
          >
            <option value="">No work order linked</option>
            {workOrders.map(wo => (
              <option key={wo.id} value={wo.id}>
                {wo.wo_reference ? `${wo.wo_reference} — ` : ''}{wo.subject.slice(0, 45)}
              </option>
            ))}
          </StyledSelect>
          {!draft.client_id && (
            <p style={{ fontSize: 12, color: 'var(--color-text-faint)', marginTop: 6 }}>
              Select a client first to see their work orders.
            </p>
          )}
        </FieldWrap>

        <Divider />

        {/* ───── BILLING DETAILS ───── */}
        <SectionLabel>Billing Details</SectionLabel>

        {/* Billing type toggle — drives Section 2 entirely */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>
            Billing Type
            <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>
          </label>
          <BillingTypeToggle
            value={draft.line_item_billing_type}
            onChange={handleBillingTypeChange}
            disabled={isLocked}
          />
          {isLocked && (
            <p style={{ fontSize: 12, color: 'var(--color-text-faint)', marginTop: 6 }}>
              🔒 Billing type cannot be changed on a finalized invoice.
            </p>
          )}
        </div>

        <FieldWrap label="SAC Code" required>
          <StyledSelect
            value={String(draft.sac_id ?? '')}
            onChange={v => patch({ sac_id: Number(v) || null })}
          >
            <option value="">Select SAC code…</option>
            {sacCodes.map(s => (
              <option key={s.id} value={s.id}>{s.sac_code} — {s.nickname}</option>
            ))}
          </StyledSelect>
        </FieldWrap>

        <FieldWrap label="Bank Account" required>
          <StyledSelect
            value={String(draft.bank_account_id ?? '')}
            onChange={v => patch({ bank_account_id: Number(v) || null })}
          >
            <option value="">Select bank account…</option>
            {bankAccounts.map(b => (
              <option key={b.id} value={b.id}>{b.nickname} — {b.account_number}</option>
            ))}
          </StyledSelect>

          {selectedBank && (
            <div style={{
              marginTop: 10,
              background: 'var(--color-surface-offset)',
              border: '1px solid var(--color-border)',
              borderRadius: 10, padding: '10px 14px',
              fontSize: 13, lineHeight: 1.8,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                {selectedBank.bank_name}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                A/C: {selectedBank.account_number}  ·  IFSC: {selectedBank.ifsc}
              </span>
              {selectedBank.branch && (
                <span style={{ color: 'var(--color-text-faint)', display: 'block', fontSize: 12 }}>
                  {selectedBank.branch} Branch
                </span>
              )}
            </div>
          )}
        </FieldWrap>

      </div>
    </div>
  )
}
