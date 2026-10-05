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
  { value: 'neft_rtgs', label: '🏦 NEFT / RTGS / IMPS' },
  { value: 'bank_transfer', label: '🏛️ Bank Direct Transfer' },
  { value: 'cheque', label: '📝 Cheque' },
  { value: 'upi', label: '⚡ UPI / Online' },
  { value: 'cash', label: '💵 Cash' },
  { value: 'other', label: '📋 Other' },
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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting && !applyingAdvance) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting, applyingAdvance])

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
  const projectedBalance = Math.max(0, balanceDue - parsedAmount)

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

  // Dynamic reference placeholder
  function getReferencePlaceholder(): string {
    switch (paymentMode) {
      case 'cheque':
        return 'e.g. Cheque No. & Bank'
      case 'upi':
        return 'e.g. UPI Ref / Txn ID'
      case 'cash':
        return 'e.g. Cash Voucher / Handed to'
      case 'neft_rtgs':
      case 'bank_transfer':
        return 'e.g. UTR / NEFT Reference'
      default:
        return 'e.g. UTR123456 / Cheque #'
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 18, 12, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'modalBackdropFade 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes modalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          background: 'var(--color-surface, #FAF8F3)',
          borderRadius: 20,
          maxWidth: 520,
          width: '100%',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(35, 23, 14, 0.35), 0 0 0 1px rgba(200, 169, 106, 0.25)',
          border: '1px solid var(--color-border, #D9D3C5)',
          overflow: 'hidden',
          animation: 'modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(217, 211, 197, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #2D1E14 0%, #3B2A1F 100%)',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                color: 'var(--color-accent, #C8A96A)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              <span>✦</span> PAYMENT RECEIPT
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontFamily: 'Playfair Display, serif',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '0.2px',
              }}
            >
              Mark Received: <span style={{ color: 'var(--color-accent, #C8A96A)' }}>{invoice.invoice_number}</span>
            </h2>
            {invoice.client_name && (
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Client: <b>{invoice.client_name}</b>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '18px 22px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Bill Financial Summary Card */}
          <div
            style={{
              background: 'var(--color-surface-offset, #EDE9DE)',
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(217, 211, 197, 0.8)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              {/* Net Bill */}
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '9px 6px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border, #D9D3C5)',
                  boxShadow: '0 1px 3px rgba(59, 42, 31, 0.04)',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted, #7A6A58)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Net Bill
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                  ₹{fmt(netReceivable)}
                </div>
              </div>

              {/* Already Received */}
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '9px 6px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border, #D9D3C5)',
                  boxShadow: '0 1px 3px rgba(59, 42, 31, 0.04)',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-text-muted, #7A6A58)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Paid So Far
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-success, #5A7A2E)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                  ₹{fmt(totalReceived)}
                </div>
              </div>

              {/* Balance Due */}
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '9px 6px',
                  borderRadius: 10,
                  border: '1.5px solid var(--color-accent, #C8A96A)',
                  boxShadow: '0 1px 4px rgba(200, 169, 106, 0.15)',
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-warning, #A05C1A)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Current Due
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-warning, #A05C1A)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                  ₹{fmt(balanceDue)}
                </div>
              </div>
            </div>
          </div>

          {/* Advance Available Banner (if client has excess unallocated credit) */}
          {clientAdvance && clientAdvance.unallocatedAdvance > 0.01 && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(200, 169, 106, 0.14) 0%, rgba(200, 169, 106, 0.06) 100%)',
                border: '1px solid rgba(200, 169, 106, 0.5)',
                borderRadius: 12,
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                  💎 Client Advance: ₹{fmt(clientAdvance.unallocatedAdvance)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Existing unallocated credit on account
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyAdvance}
                disabled={applyingAdvance}
                style={{
                  background: 'var(--color-accent, #C8A96A)',
                  color: 'var(--color-primary, #3B2A1F)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 13px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: applyingAdvance ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(200, 169, 106, 0.3)',
                  transition: 'opacity 0.15s ease',
                  opacity: applyingAdvance ? 0.65 : 1,
                }}
              >
                {applyingAdvance ? 'Applying…' : `Apply ₹${fmt(Math.min(clientAdvance.unallocatedAdvance, balanceDue))}`}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              HERO ROW: Amount Received (Flexible width) + Received Date (Snug compact)
              Fixes user complaint: Date input was taking excessive 100% width!
             ══════════════════════════════════════════════════════════════════════════ */}
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Amount Received Field (Takes remaining generous space) */}
              <div style={{ flex: '1 1 230px', minWidth: 'min(100%, 200px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label htmlFor="modal-amount-input" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    Amount Received <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  {/* Quick Preset Chips */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      type="button"
                      onClick={() => setAmount(String(balanceDue))}
                      style={{
                        background: 'rgba(200, 169, 106, 0.18)',
                        border: '1px solid rgba(200, 169, 106, 0.45)',
                        color: 'var(--color-primary)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: 6,
                        transition: 'background-color 0.15s ease',
                      }}
                      title="Set to full outstanding balance"
                    >
                      Full Due (₹{fmt(balanceDue)})
                    </button>
                    {balanceDue > 1000 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.round(balanceDue / 2)))}
                        style={{
                          background: 'rgba(0, 0, 0, 0.04)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-muted)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: 6,
                        }}
                        title="Set to 50% of balance"
                      >
                        50%
                      </button>
                    )}
                  </div>
                </div>

                {/* Amount Input with Styled Currency Prefix */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--color-text-muted, #7A6A58)',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    id="modal-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: 42,
                      padding: '8px 12px 8px 30px',
                      borderRadius: 10,
                      border: '1.5px solid var(--color-border, #D9D3C5)',
                      background: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: 'Work Sans, sans-serif',
                      fontVariantNumeric: 'tabular-nums',
                      outline: 'none',
                      color: 'var(--color-text)',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--color-accent, #C8A96A)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(200, 169, 106, 0.2)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--color-border, #D9D3C5)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* Received Date Field (Snug, compact, exactly 165px wide) */}
              <div style={{ flex: '0 0 165px', width: 165, minWidth: 150 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label htmlFor="modal-date-input" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    Received Date <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  {paymentDate !== today && (
                    <button
                      type="button"
                      onClick={() => setPaymentDate(today)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent, #C8A96A)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                      title="Set to today's date"
                    >
                      Today
                    </button>
                  )}
                </div>

                <input
                  id="modal-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 42,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1.5px solid var(--color-border, #D9D3C5)',
                    background: '#FFFFFF',
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: 'Work Sans, sans-serif',
                    colorScheme: 'light',
                    outline: 'none',
                    color: 'var(--color-text)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--color-accent, #C8A96A)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(200, 169, 106, 0.2)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--color-border, #D9D3C5)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Live Clearance Impact Preview */}
            <div style={{ marginTop: 8 }}>
              {parsedAmount <= 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                  Enter the amount received to preview status update.
                </div>
              ) : isFullClearance ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(90, 122, 46, 0.12)',
                    border: '1px solid rgba(90, 122, 46, 0.3)',
                    color: 'var(--color-success, #5A7A2E)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span>✓</span>
                  <span>
                    Full Settlement: Bill will be marked <b>Fully Cleared</b> (Remaining Balance: ₹0.00).
                  </span>
                </div>
              ) : isPartialClearance ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(160, 92, 26, 0.1)',
                    border: '1px solid rgba(160, 92, 26, 0.25)',
                    color: 'var(--color-warning, #A05C1A)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span>⏳</span>
                  <span>
                    Partial Payment: Remaining balance will be <b>₹{fmt(projectedBalance)}</b>.
                  </span>
                </div>
              ) : isOverBalance ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--color-error-highlight)',
                    border: '1px solid rgba(139, 46, 46, 0.3)',
                    color: 'var(--color-error)',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <div>
                    Amount exceeds current balance by <b>₹{fmt(parsedAmount - balanceDue)}</b>.
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                      For multi-bill distribution or lump sums, use the Payment entry on the Home page.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment Mode & Reference # (Balanced 2 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div>
              <label htmlFor="modal-payment-mode" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Payment Mode (Optional)
              </label>
              <select
                id="modal-payment-mode"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 40,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: '#FFFFFF',
                  fontSize: 13,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                {PAYMENT_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-reference-number" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                {paymentMode === 'cheque'
                  ? 'Cheque #'
                  : paymentMode === 'cash'
                  ? 'Voucher / Handed To'
                  : 'Ref / UTR # (Optional)'}
              </label>
              <input
                id="modal-reference-number"
                type="text"
                placeholder={getReferencePlaceholder()}
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 40,
                  padding: '8px 11px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: '#FFFFFF',
                  fontSize: 13,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Notes / Memo (Optional) */}
          <div>
            <label htmlFor="modal-notes" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Notes / Remarks (Optional)
            </label>
            <input
              id="modal-notes"
              type="text"
              placeholder="e.g. Bank confirmation, remittance advice, or transaction details"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 40,
                padding: '8px 11px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: '#FFFFFF',
                fontSize: 13,
                fontFamily: 'Work Sans, sans-serif',
                outline: 'none',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Confirmation / Acknowledgment Card */}
          <div
            onClick={() => setAcknowledged(prev => !prev)}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: acknowledged ? 'rgba(90, 122, 46, 0.08)' : 'var(--color-surface-offset, #EDE9DE)',
              border: `1.5px solid ${acknowledged ? 'rgba(90, 122, 46, 0.35)' : 'var(--color-border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              id="ack-check"
              checked={acknowledged}
              onChange={e => {
                e.stopPropagation()
                setAcknowledged(e.target.checked)
              }}
              style={{
                cursor: 'pointer',
                width: 18,
                height: 18,
                accentColor: 'var(--color-success, #5A7A2E)',
                flexShrink: 0,
              }}
            />
            <label
              htmlFor="ack-check"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 12.5,
                color: 'var(--color-text)',
                cursor: 'pointer',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              I confirm that <b style={{ color: 'var(--color-primary)' }}>₹{fmt(parsedAmount)}</b> was received on <b style={{ color: 'var(--color-primary)' }}>{paymentDate}</b> for Invoice <b style={{ color: 'var(--color-primary)' }}>{invoice.invoice_number}</b>.
            </label>
          </div>

          {/* Error Message Banner */}
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--color-error-highlight)',
                border: '1px solid var(--color-error)',
                color: 'var(--color-error)',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Action Buttons Footer */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, paddingTop: 2 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || applyingAdvance}
              style={{
                flex: '1 1 100px',
                minHeight: 44,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1.5px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: submitting || applyingAdvance ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!submitting) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || applyingAdvance || parsedAmount <= 0 || !acknowledged}
              style={{
                flex: '2 1 200px',
                minHeight: 44,
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background:
                  submitting || applyingAdvance || parsedAmount <= 0 || !acknowledged
                    ? 'var(--color-border)'
                    : 'linear-gradient(135deg, #3B2A1F 0%, #2A1D15 100%)',
                color:
                  submitting || applyingAdvance || parsedAmount <= 0 || !acknowledged
                    ? 'var(--color-text-faint)'
                    : '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor:
                  submitting || applyingAdvance || parsedAmount <= 0 || !acknowledged
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow:
                  submitting || applyingAdvance || parsedAmount <= 0 || !acknowledged
                    ? 'none'
                    : '0 3px 12px rgba(59, 42, 31, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.18s ease',
              }}
            >
              {submitting ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'modalSpin 0.75s linear infinite',
                    }}
                  />
                  <span>Recording Payment…</span>
                </>
              ) : (
                <>
                  <span>Confirm & Save Receipt</span>
                  {parsedAmount > 0 && (
                    <span style={{ opacity: 0.85, fontWeight: 500, fontSize: 13 }}>
                      (₹{fmt(parsedAmount)})
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
