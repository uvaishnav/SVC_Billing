import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([])
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
    setSelectedInvoiceIds([])
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

  const hasCustomSelection = selectedInvoiceIds.length > 0

  const selectedBills = useMemo(() => {
    if (!hasCustomSelection) return bills
    return bills.filter(b => selectedInvoiceIds.includes(b.id))
  }, [bills, hasCustomSelection, selectedInvoiceIds])

  const selectedBillsTotalDue = useMemo(() => {
    return selectedBills.reduce((sum, b) => sum + b.balanceDue, 0)
  }, [selectedBills])

  const isSelectionInsufficient = hasCustomSelection && parsedAmount > 0 && selectedBillsTotalDue < parsedAmount - 0.01
  const selectionShortfall = isSelectionInsufficient ? Math.max(0, Math.round((parsedAmount - selectedBillsTotalDue) * 100) / 100) : 0

  const preview: FifoAllocationPreview = useMemo(() => {
    return calculateFifoAllocation(bills, parsedAmount, hasCustomSelection ? selectedInvoiceIds : undefined)
  }, [bills, parsedAmount, hasCustomSelection, selectedInvoiceIds])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  function toggleInvoiceSelection(invoiceId: number) {
    setSelectedInvoiceIds(prev => {
      if (prev.includes(invoiceId)) {
        return prev.filter(id => id !== invoiceId)
      } else {
        return [...prev, invoiceId]
      }
    })
  }

  function handleSelectAll() {
    setSelectedInvoiceIds(bills.map(b => b.id))
  }

  function handleClearSelection() {
    setSelectedInvoiceIds([])
  }

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
    if (isSelectionInsufficient) {
      setErrorMsg(`Selected invoices total ₹${fmt(selectedBillsTotalDue)}, which is ₹${fmt(selectionShortfall)} less than ₹${fmt(parsedAmount)}. Please choose additional invoices to cover the payment.`)
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
        selectedInvoiceIds: hasCustomSelection ? selectedInvoiceIds : undefined,
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

  const [breakdownView, setBreakdownView] = useState<'cards' | 'table'>('cards')

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 20, 10, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 10px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface, #FAF8F3)',
          borderRadius: 18,
          maxWidth: 640,
          width: '100%',
          maxHeight: '94dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(43,31,21,0.3)',
          border: '1px solid var(--color-border, #D9D3C5)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--color-border, #D9D3C5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-primary, #3B2A1F)',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--color-accent, #C8A96A)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Client Payment Entry
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'Playfair Display, serif', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Add Received Amount (Lump Sum / FIFO)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
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

          {/* Amount and Date Fields (Responsive 1 or 2 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  Amount Received (₹) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {hasCustomSelection && selectedBillsTotalDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(selectedBillsTotalDue))}
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
                      Selected (₹{fmt(selectedBillsTotalDue)})
                    </button>
                  )}
                  {totalClientPending > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(totalClientPending))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: hasCustomSelection ? 'var(--color-text-muted)' : 'var(--color-primary)',
                        fontSize: 11,
                        fontWeight: hasCustomSelection ? 500 : 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      All Dues (₹{fmt(totalClientPending)})
                    </button>
                  )}
                </div>
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
                  border: isSelectionInsufficient ? '1.5px solid var(--color-warning, #A05C1A)' : '1.5px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                  color: 'var(--color-text)',
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
                  border: '1.5px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Mode & Reference (Responsive 1 or 2 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
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
                  color: 'var(--color-text)',
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
                  color: 'var(--color-text)',
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
              placeholder="e.g. Cleared specific bills"
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
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Selection Under-funded Warning Banner */}
          {isSelectionInsufficient && (
            <div
              style={{
                background: 'rgba(160, 92, 26, 0.12)',
                border: '1.5px solid var(--color-warning, #A05C1A)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning, #A05C1A)' }}>
                  Please Select Additional Invoices (Shortfall: ₹{fmt(selectionShortfall)})
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text)', marginTop: 3, lineHeight: 1.45 }}>
                  The <b>{selectedInvoiceIds.length}</b> selected invoice{selectedInvoiceIds.length === 1 ? '' : 's'} sum to <b>₹{fmt(selectedBillsTotalDue)}</b>, which is less than the entered payment of <b>₹{fmt(parsedAmount)}</b>.
                  Please select more invoices below so their total covers this amount, or{' '}
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-primary)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    clear selection to use default FIFO across all bills
                  </button>.
                </div>
              </div>
            </div>
          )}

          {/* Selection Sufficient Success Banner */}
          {hasCustomSelection && !isSelectionInsufficient && parsedAmount > 0 && (
            <div
              style={{
                background: 'rgba(90, 122, 46, 0.1)',
                border: '1px solid var(--color-success, #5A7A2E)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>✓</span>
              <div style={{ fontSize: 12, color: 'var(--color-success, #5A7A2E)', fontWeight: 600 }}>
                {selectedInvoiceIds.length} invoice{selectedInvoiceIds.length === 1 ? '' : 's'} selected (Total: ₹{fmt(selectedBillsTotalDue)}). Funds will be applied first to the earliest created bill among your selection.
              </div>
            </div>
          )}

          {/* Excess Advance Banner (Only in Auto FIFO mode when payment exceeds all bills) */}
          {!hasCustomSelection && preview.unallocatedAdvance > 0.01 && (
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

          {/* Invoice Clearance Allocation Preview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif' }}>
                    Bill Clearance Allocation
                  </span>
                  {hasCustomSelection ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: isSelectionInsufficient ? 'rgba(160,92,26,0.15)' : 'rgba(59,42,31,0.1)',
                        color: isSelectionInsufficient ? 'var(--color-warning)' : 'var(--color-primary)',
                      }}
                    >
                      🎯 {selectedInvoiceIds.length} Selected (₹{fmt(selectedBillsTotalDue)})
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: 'var(--color-surface-offset)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      ⚡ Auto FIFO (Oldest First)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>
                  {hasCustomSelection
                    ? 'Targeting selected invoices (earliest date first). Click an invoice to toggle selection.'
                    : 'Check any invoice to selectively allocate money, or leave unselected for auto FIFO.'}
                </div>
              </div>

              {preview.items.length > 0 && !loadingBills && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {hasCustomSelection ? (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Clear Selection
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Select All
                    </button>
                  )}

                  <div style={{ display: 'flex', background: 'var(--color-surface-offset)', padding: 2, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      onClick={() => setBreakdownView('cards')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: breakdownView === 'cards' ? '#fff' : 'transparent',
                        color: breakdownView === 'cards' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: breakdownView === 'cards' ? 700 : 500,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakdownView('table')}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: breakdownView === 'table' ? '#fff' : 'transparent',
                        color: breakdownView === 'table' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: breakdownView === 'table' ? 700 : 500,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Table
                    </button>
                  </div>
                </div>
              )}
            </div>

            {loadingBills ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-faint)', fontSize: 13 }}>
                Loading bills…
              </div>
            ) : preview.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 12px', background: 'var(--color-surface-offset)', borderRadius: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>
                🎉 No pending bills found for {selectedClient?.name}. The entire payment will be saved as an Advance Balance.
              </div>
            ) : breakdownView === 'cards' ? (
              /* Mobile-optimized card list with checkboxes */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {preview.items.map(item => {
                  const isChecked = selectedInvoiceIds.includes(item.invoiceId)
                  const isExcluded = hasCustomSelection && !isChecked

                  return (
                    <div
                      key={item.invoiceId}
                      onClick={() => toggleInvoiceSelection(item.invoiceId)}
                      style={{
                        background: isExcluded
                          ? 'rgba(237, 233, 222, 0.4)'
                          : item.allocatedNow > 0
                            ? item.newStatus === 'cleared'
                              ? 'rgba(90,122,46,0.06)'
                              : 'rgba(160,92,26,0.06)'
                            : '#fff',
                        border: `1.5px solid ${
                          isChecked
                            ? 'var(--color-primary, #3B2A1F)'
                            : item.allocatedNow > 0
                              ? item.newStatus === 'cleared'
                                ? 'rgba(90,122,46,0.35)'
                                : 'rgba(160,92,26,0.35)'
                              : 'var(--color-border)'
                        }`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        cursor: 'pointer',
                        opacity: isExcluded ? 0.6 : 1,
                        transition: 'all 120ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                          />
                          <div style={{ fontWeight: 600, fontSize: 13, color: isExcluded ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                            {item.invoiceNumber}
                          </div>
                          {isChecked && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff' }}>
                              Selected
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {item.invoiceDate}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 4 }}>
                        <div>
                          <span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Due: </span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>₹{fmt(item.balanceDue)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div>
                            <span style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>Clearing: </span>
                            <span style={{ fontWeight: 700, color: item.allocatedNow > 0 ? 'var(--color-primary)' : 'var(--color-text-faint)' }}>
                              ₹{fmt(item.allocatedNow)}
                            </span>
                          </div>

                          {isExcluded ? (
                            <span style={{ fontSize: 10, color: 'var(--color-text-faint)', padding: '2px 6px', background: 'var(--color-surface-offset)', borderRadius: 6 }}>
                              Excluded
                            </span>
                          ) : item.allocatedNow <= 0 ? (
                            <span style={{ fontSize: 10, color: 'var(--color-text-faint)', padding: '2px 6px', background: 'var(--color-surface-offset)', borderRadius: 6 }}>
                              Unchanged
                            </span>
                          ) : item.newStatus === 'cleared' ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(90,122,46,0.15)', color: 'var(--color-success)' }}>
                              🟢 Cleared
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(160,92,26,0.15)', color: 'var(--color-warning)' }}>
                              🟠 Partial
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Horizontally scrollable table with checkboxes */
              <div
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  maxHeight: 230,
                  overflowY: 'auto',
                }}
              >
                <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 10px', width: 34, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.length === bills.length && bills.length > 0}
                          onChange={e => {
                            if (e.target.checked) handleSelectAll()
                            else handleClearSelection()
                          }}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--color-primary)' }}
                          title="Toggle select all"
                        />
                      </th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Invoice</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Balance Due</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Clearing Now</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map(item => {
                      const isChecked = selectedInvoiceIds.includes(item.invoiceId)
                      const isExcluded = hasCustomSelection && !isChecked

                      return (
                        <tr
                          key={item.invoiceId}
                          onClick={() => toggleInvoiceSelection(item.invoiceId)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--color-border)',
                            background: isExcluded
                              ? 'rgba(237, 233, 222, 0.3)'
                              : isChecked
                                ? 'rgba(200, 169, 106, 0.08)'
                                : item.allocatedNow > 0
                                  ? item.newStatus === 'cleared'
                                    ? 'rgba(90,122,46,0.06)'
                                    : 'rgba(160,92,26,0.06)'
                                  : 'transparent',
                            opacity: isExcluded ? 0.6 : 1,
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleInvoiceSelection(item.invoiceId)}
                              style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--color-primary)' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: isExcluded ? 'var(--color-text-muted)' : 'var(--color-text)', whiteSpace: 'nowrap' }}>
                            {item.invoiceNumber}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {item.invoiceDate}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            ₹{fmt(item.balanceDue)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.allocatedNow > 0 ? 'var(--color-primary)' : 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                            ₹{fmt(item.allocatedNow)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isExcluded ? (
                              <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Excluded</span>
                            ) : item.allocatedNow <= 0 ? (
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
                      )
                    })}
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
              style={{ marginTop: 3, cursor: 'pointer', width: 16, height: 16 }}
            />
            <label htmlFor="ack-fifo-check" style={{ fontSize: 12, color: 'var(--color-text)', cursor: 'pointer', lineHeight: 1.4 }}>
              I confirm receipt of <b>₹{fmt(parsedAmount)}</b> from <b>{selectedClient?.name ?? 'client'}</b> on <b>{paymentDate}</b>
              {hasCustomSelection
                ? ` to clear ${selectedInvoiceIds.length} selected invoice${selectedInvoiceIds.length === 1 ? '' : 's'} (earliest date first).`
                : ' to clear bills in ascending order (FIFO).'}
            </label>
          </div>

          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-highlight)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 12 }}>
              {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: '1 1 100px',
                minHeight: 46,
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
              disabled={submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId || isSelectionInsufficient}
              style={{
                flex: '2 1 200px',
                minHeight: 46,
                padding: '11px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-primary, #3B2A1F)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId || isSelectionInsufficient ? 'not-allowed' : 'pointer',
                opacity: submitting || parsedAmount <= 0 || !acknowledged || !selectedClientId || isSelectionInsufficient ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(59,42,31,0.25)',
              }}
            >
              {submitting
                ? 'Applying Payments…'
                : isSelectionInsufficient
                  ? `Select More Invoices (Need ₹${fmt(selectionShortfall)} more)`
                  : hasCustomSelection
                    ? `Confirm & Clear Selected (₹${fmt(parsedAmount)})`
                    : `Confirm & Clear (₹${fmt(parsedAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
