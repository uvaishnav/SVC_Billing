import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { InvoiceWithDetails } from '../../db/types'
import {
  recordInvoicePayment,
  getClientAdvances,
  applyAdvanceToInvoice,
  type ClientAdvancesResult
} from '../../db/paymentsDb'

interface Props {
  invoice: InvoiceWithDetails
  onClose: () => void
  onSuccess: () => void
}

function fmt(n?: number | null): string {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

const PAYMENT_MODES = [
  { value: '', label: 'Select mode (Optional)' },
  { value: 'neft_rtgs', label: 'NEFT / RTGS / IMPS' },
  { value: 'bank_transfer', label: 'Bank Direct Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI / Online' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

export default function MarkReceivedModal({ invoice, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const balanceDue = Number(invoice.balance_due ?? invoice.net_receivable ?? 0)
  const netReceivable = Number(invoice.net_receivable ?? 0)
  const totalReceived = Number(invoice.total_received ?? 0)
  const initialAmount = balanceDue > 0 ? balanceDue : netReceivable

  const [paymentDate, setPaymentDate] = useState<string>(today)
  const [amount, setAmount] = useState<string>(String(initialAmount))
  const [paymentMode, setPaymentMode] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [acknowledged, setAcknowledged] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Advance tracking
  const [clientAdvance, setClientAdvance] = useState<ClientAdvancesResult | null>(null)
  const [applyingAdvance, setApplyingAdvance] = useState<boolean>(false)

  useEffect(() => {
    if (invoice.client_id) {
      getClientAdvances(invoice.client_id)
        .then(setClientAdvance)
        .catch(err => console.warn('Could not load client advances:', err))
    }
  }, [invoice.client_id])

  const parsedAmount = parseFloat(amount) || 0
  const isFullClearance = Math.abs(parsedAmount - balanceDue) <= 0.01
  const isPartialClearance = parsedAmount > 0 && parsedAmount < balanceDue - 0.01
  const isOverBalance = parsedAmount > balanceDue + 0.01

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice.client_id) {
      setErrorMsg('Invoice has no associated client.')
      return
    }
    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.')
      return
    }
    if (!acknowledged) {
      setErrorMsg('Please confirm the payment acknowledgment.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await recordInvoicePayment({
        invoiceId: invoice.id,
        clientId: invoice.client_id,
        amount: parsedAmount,
        paymentDate,
        paymentMode: paymentMode || null,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      })

      if (!res.ok) {
        setErrorMsg(res.error ?? 'Failed to record payment.')
        setSubmitting(false)
        return
      }

      onSuccess()
    } catch (err: any) {
      setErrorMsg(err.message ?? 'An unexpected error occurred.')
      setSubmitting(false)
    }
  }

  async function handleApplyAdvance() {
    if (!invoice.client_id || !clientAdvance || clientAdvance.unallocatedAdvance <= 0) return
    const toApply = Math.min(clientAdvance.unallocatedAdvance, balanceDue)
    if (toApply <= 0) return

    setApplyingAdvance(true)
    setErrorMsg('')

    const res = await applyAdvanceToInvoice(invoice.client_id, invoice.id, toApply)
    setApplyingAdvance(false)

    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to apply advance.')
      return
    }

    onSuccess()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 20, 10, 0.65)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface, #FAF8F3)',
          borderRadius: 18,
          maxWidth: 480,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(43,31,21,0.25)',
          border: '1px solid var(--color-border, #D9D3C5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--color-border, #D9D3C5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-primary, #3B2A1F)',
            color: '#fff',
            borderTopLeftRadius: 17,
            borderTopRightRadius: 17,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-accent, #C8A96A)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Payment Receipt
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'Playfair Display, serif', color: '#fff' }}>
              Mark Received: {invoice.invoice_number}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bill Summary Card */}
          <div
            style={{
              background: 'var(--color-surface-offset, #EDE9DE)',
              borderRadius: 12,
              padding: '14px',
              border: '1px solid rgba(217,211,197,0.8)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text, #2A1F15)', marginBottom: 6 }}>
              {invoice.client_name ?? 'Client'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Net Bill</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  ₹{fmt(netReceivable)}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Received</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success, #5A7A2E)' }}>
                  ₹{fmt(totalReceived)}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Balance Due</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning, #A05C1A)' }}>
                  ₹{fmt(balanceDue)}
                </div>
              </div>
            </div>
          </div>

          {/* Advance Available Banner (if any) */}
          {clientAdvance && clientAdvance.unallocatedAdvance > 0.01 && (
            <div
              style={{
                background: 'rgba(200, 169, 106, 0.15)',
                border: '1px solid var(--color-accent, #C8A96A)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>
                  💎 Client Advance Available: ₹{fmt(clientAdvance.unallocatedAdvance)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  From previous excess lump-sum payments
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyAdvance}
                disabled={applyingAdvance}
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {applyingAdvance ? 'Applying…' : 'Apply Advance'}
              </button>
            </div>
          )}

          {/* Received Date Field */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Received Date <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: 14,
                fontFamily: 'Work Sans, sans-serif',
                outline: 'none',
              }}
            />
          </div>

          {/* Amount Field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                Amount Received (₹) <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(balanceDue))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Full Balance (₹{fmt(balanceDue)})
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              placeholder="e.g. 50000"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'Work Sans, sans-serif',
                outline: 'none',
              }}
            />

            {/* Clearance status badge preview */}
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {isFullClearance && (
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  🟢 This will mark the bill as <b>Fully Cleared</b>.
                </span>
              )}
              {isPartialClearance && (
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                  🟠 This will mark the bill as <b>Partially Cleared</b> (₹{fmt(balanceDue - parsedAmount)} remaining balance).
                </span>
              )}
              {isOverBalance && (
                <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                  ⚠️ Amount exceeds bill balance due by ₹{fmt(parsedAmount - balanceDue)}. For lump-sum payments across multiple bills, use the Home page payment option.
                </span>
              )}
            </div>
          </div>

          {/* Payment Mode (Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Mode (Optional)
              </label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 13,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                }}
              >
                {PAYMENT_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Reference # (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Ref / UTR # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UTR123456"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 13,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="Any remarks or remittance notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: 13,
                fontFamily: 'Work Sans, sans-serif',
                outline: 'none',
              }}
            />
          </div>

          {/* Acknowledgment Checkbox */}
          <div
            style={{
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(90,122,46,0.08)',
              border: '1px solid rgba(90,122,46,0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              id="ack-check"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <label htmlFor="ack-check" style={{ fontSize: 12, color: 'var(--color-text)', cursor: 'pointer', lineHeight: 1.4 }}>
              I confirm that <b>₹{fmt(parsedAmount)}</b> was received from <b>{invoice.client_name ?? 'the company'}</b> on <b>{paymentDate}</b> for Invoice <b>{invoice.invoice_number}</b>.
            </label>
          </div>

          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-highlight)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 12 }}>
              {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || parsedAmount <= 0 || !acknowledged}
              style={{
                flex: 2,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-primary, #3B2A1F)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || parsedAmount <= 0 || !acknowledged ? 'not-allowed' : 'pointer',
                opacity: submitting || parsedAmount <= 0 || !acknowledged ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(59,42,31,0.25)',
              }}
            >
              {submitting ? 'Recording…' : 'Confirm & Save Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
