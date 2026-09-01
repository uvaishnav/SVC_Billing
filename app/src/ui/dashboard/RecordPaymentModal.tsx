import { useEffect, useState, useMemo } from 'react'
import { getClients } from '../../db/clientsDb'
import type { Client } from '../../db/types'
import {
  getClientOutstandingBills,
  calculateFifoAllocation,
  recordLumpSumPayment,
  type FifoAllocationPreview
} from '../../db/paymentsDb'

interface Props {
  onClose: () => void
  onSuccess: () => void
  initialClientId?: number
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
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

export default function RecordPaymentModal({ onClose, onSuccess, initialClientId }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId ?? null)
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(today)
  const [paymentMode, setPaymentMode] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [acknowledged, setAcknowledged] = useState<boolean>(true)

  const [bills, setBills] = useState<Awaited<ReturnType<typeof getClientOutstandingBills>>>([])
  const [loadingBills, setLoadingBills] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Load clients list
  useEffect(() => {
    getClients().then(data => {
      const active = data.filter(c => c.is_active)
      setClients(active)
      if (!selectedClientId && active.length > 0) {
        setSelectedClientId(active[0].id)
      }
    })
  }, [])

  // Load client's outstanding bills when client selection changes
  useEffect(() => {
    if (!selectedClientId) {
      setBills([])
      return
    }

    setLoadingBills(true)
    getClientOutstandingBills(selectedClientId)
      .then(b => {
        setBills(b)
        setLoadingBills(false)
      })
      .catch(err => {
        console.error('Error fetching bills:', err)
        setLoadingBills(false)
      })
  }, [selectedClientId])

  const totalClientPending = useMemo(() => {
    return bills.reduce((sum, b) => sum + b.balanceDue, 0)
  }, [bills])

  const parsedAmount = parseFloat(amount) || 0

  const preview: FifoAllocationPreview = useMemo(() => {
    return calculateFifoAllocation(bills, parsedAmount)
  }, [bills, parsedAmount])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClientId) {
      setErrorMsg('Please select a client.')
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
      const res = await recordLumpSumPayment({
        clientId: selectedClientId,
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(25, 18, 12, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 180ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface, #FAF8F3)',
          borderRadius: 18,
          maxWidth: 620,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(43,31,21,0.25)',
          border: '1px solid var(--color-border, #D9D3C5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
              Client Payment Entry
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'Playfair Display, serif', color: '#fff' }}>
              Add Received Amount (Lump Sum / FIFO)
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Client Selection Row */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Select Client <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              value={selectedClientId ?? ''}
              onChange={e => setSelectedClientId(Number(e.target.value) || null)}
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
                color: 'var(--color-text)',
              }}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Outstanding Overview Banner */}
          <div
            style={{
              background: 'var(--color-surface-offset, #EDE9DE)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid rgba(217,211,197,0.8)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>Total Pending Bills for {selectedClient?.name ?? 'Client'}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-warning, #A05C1A)' }}>
                ₹{fmt(totalClientPending)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {bills.length} uncleared / partial bill{bills.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Amount and Date Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  Amount Received (₹) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                {totalClientPending > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(totalClientPending))}
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
                    Clear All
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                placeholder="e.g. 250000"
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
            </div>

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
          </div>

          {/* Mode & Reference */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Payment Mode (Optional)
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

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Ref / Cheque / UTR # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UTR987654"
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
              placeholder="e.g. Cleared 2 bills + partial on 3rd"
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

          {/* Excess Advance Banner */}
          {preview.unallocatedAdvance > 0.01 && (
            <div
              style={{
                background: 'rgba(200, 169, 106, 0.16)',
                border: '1px solid var(--color-accent, #C8A96A)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>💎</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                  All bills cleared! Remaining ₹{fmt(preview.unallocatedAdvance)} saved as Excess Advance
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  This amount will stay on {selectedClient?.name}'s account and can be applied to future bills anytime.
                </div>
              </div>
            </div>
          )}

          {/* FIFO Bill Clearance Allocation Preview Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif' }}>
                Bill Clearance Breakdown (Ascending Order / FIFO)
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
                Oldest bills cleared first
              </span>
            </div>

            {loadingBills ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-faint)', fontSize: 13 }}>
                Loading bills…
              </div>
            ) : preview.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', background: 'var(--color-surface-offset)', borderRadius: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>
                🎉 No pending bills found for {selectedClient?.name}. The entire payment will be saved as an Advance Balance.
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 10px' }}>Invoice</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance Due</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Clearing Now</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map(item => (
                      <tr
                        key={item.invoiceId}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: item.allocatedNow > 0 ? (item.newStatus === 'cleared' ? 'rgba(90,122,46,0.06)' : 'rgba(160,92,26,0.06)') : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {item.invoiceNumber}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                          {item.invoiceDate}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                          ₹{fmt(item.balanceDue)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.allocatedNow > 0 ? 'var(--color-primary)' : 'var(--color-text-faint)' }}>
                          ₹{fmt(item.allocatedNow)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {item.allocatedNow <= 0 ? (
                            <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Unchanged</span>
                          ) : item.newStatus === 'cleared' ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(90,122,46,0.15)', color: 'var(--color-success)' }}>
                              🟢 Cleared
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(160,92,26,0.15)', color: 'var(--color-warning)' }}>
                              🟠 Partial
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              id="ack-fifo-check"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <label htmlFor="ack-fifo-check" style={{ fontSize: 12, color: 'var(--color-text)', cursor: 'pointer', lineHeight: 1.4 }}>
              I confirm receipt of <b>₹{fmt(parsedAmount)}</b> from <b>{selectedClient?.name ?? 'client'}</b> on <b>{paymentDate}</b> to clear bills in ascending order.
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
              disabled={submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId}
              style={{
                flex: 2,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-primary, #3B2A1F)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId ? 'not-allowed' : 'pointer',
                opacity: submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(59,42,31,0.25)',
              }}
            >
              {submitting ? 'Applying Payments…' : `Confirm & Clear (₹${fmt(parsedAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
