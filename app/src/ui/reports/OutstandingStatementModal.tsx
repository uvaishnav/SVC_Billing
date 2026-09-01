import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { pdf } from '@react-pdf/renderer'
import { getClients } from '../../db/clientsDb'
import { getSettings, getBankAccounts } from '../../db/settingsDb'
import type { ClientWithGstins, Settings, BankAccount } from '../../db/types'
import {
  getClientOutstandingBills,
  getClientAdvances,
  type ClientAdvancesResult
} from '../../db/paymentsDb'
import {
  OutstandingStatementPdf,
  type StatementItem,
  type StatementBankSummary,
} from './OutstandingStatementPdf'

interface Props {
  initialClientId?: number
  onClose: () => void
}

function fmt(n?: number | null): string {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OutstandingStatementModal({ initialClientId, onClose }: Props) {
  const [clients, setClients] = useState<ClientWithGstins[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId ?? null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [bills, setBills] = useState<Awaited<ReturnType<typeof getClientOutstandingBills>>>([])
  const [advances, setAdvances] = useState<ClientAdvancesResult | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false)
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false)

  // Load masters
  useEffect(() => {
    Promise.all([getClients(), getSettings(), getBankAccounts()]).then(([cList, s, bList]) => {
      setClients(cList)
      setSettings(s)
      setBankAccounts(bList)
      if (!selectedClientId && cList.length > 0) {
        setSelectedClientId(cList[0].id)
      }
    }).catch(err => {
      console.warn('Error loading statement masters:', err)
    })
  }, [])

  // Load bills and advances for selected client
  useEffect(() => {
    if (!selectedClientId) {
      setBills([])
      setAdvances(null)
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      getClientOutstandingBills(selectedClientId),
      getClientAdvances(selectedClientId),
    ]).then(([b, adv]) => {
      setBills(b)
      setAdvances(adv)
      setLoading(false)
    }).catch(err => {
      console.error('Error loading client statement data:', err)
      setLoading(false)
    })
  }, [selectedClientId])

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId)
  }, [clients, selectedClientId])

  const selectedGstin = useMemo(() => {
    if (!selectedClient || !selectedClient.gstins || selectedClient.gstins.length === 0) return null
    return selectedClient.gstins.find(g => g.is_primary) ?? selectedClient.gstins[0]
  }, [selectedClient])

  // Group unsettled bills by their assigned bank account
  const bankSummaries = useMemo<StatementBankSummary[]>(() => {
    const defId = settings?.default_bank_account_id
    const fallbackBank = bankAccounts.find(b => b.id === defId) ?? bankAccounts[0]

    if (bills.length === 0) {
      return [{
        bankId: fallbackBank?.id,
        accountName: fallbackBank?.account_name ?? settings?.business_name ?? 'Sri Vaishnav Constructions',
        bankName: fallbackBank?.bank_name ?? 'State Bank of India',
        accountNumber: fallbackBank?.account_number ?? '—',
        ifsc: fallbackBank?.ifsc ?? '—',
        branch: fallbackBank?.branch ?? null,
        nickname: fallbackBank?.nickname ?? null,
        totalDue: 0,
        billsCount: 0,
        invoiceNumbers: [],
      }]
    }

    const groupMap = new Map<string, StatementBankSummary>()

    for (const b of bills) {
      let matchedBank: BankAccount | undefined = undefined
      if (b.bankAccountId) {
        matchedBank = bankAccounts.find(acc => acc.id === b.bankAccountId)
      }
      if (!matchedBank && (b as any).bankAccount) {
        matchedBank = {
          id: (b as any).bankAccount.id,
          account_name: (b as any).bankAccount.accountName,
          bank_name: (b as any).bankAccount.bankName,
          account_number: (b as any).bankAccount.accountNumber,
          ifsc: (b as any).bankAccount.ifsc,
          branch: (b as any).bankAccount.branch,
          nickname: (b as any).bankAccount.nickname ?? '',
          is_active: true,
          created_at: '',
        }
      }
      if (!matchedBank) {
        matchedBank = fallbackBank
      }

      const key = matchedBank ? `bank_${matchedBank.id}` : 'default_fallback'
      const existing = groupMap.get(key)
      const due = Number(b.balanceDue || 0)

      if (existing) {
        existing.totalDue = Math.round((existing.totalDue + due) * 100) / 100
        existing.billsCount += 1
        existing.invoiceNumbers.push(b.invoiceNumber)
      } else {
        groupMap.set(key, {
          bankId: matchedBank?.id,
          accountName: matchedBank?.account_name ?? settings?.business_name ?? 'Sri Vaishnav Constructions',
          bankName: matchedBank?.bank_name ?? 'State Bank of India',
          accountNumber: matchedBank?.account_number ?? '—',
          ifsc: matchedBank?.ifsc ?? '—',
          branch: matchedBank?.branch ?? null,
          nickname: matchedBank?.nickname ?? null,
          totalDue: Math.round(due * 100) / 100,
          billsCount: 1,
          invoiceNumbers: [b.invoiceNumber],
        })
      }
    }

    return Array.from(groupMap.values())
  }, [bills, bankAccounts, settings])

  const statementItems: StatementItem[] = useMemo(() => {
    const defId = settings?.default_bank_account_id
    const fallbackBank = bankAccounts.find(b => b.id === defId) ?? bankAccounts[0]

    return bills.map(b => {
      let matchedBank = b.bankAccountId ? bankAccounts.find(acc => acc.id === b.bankAccountId) : null
      if (!matchedBank && (b as any).bankAccount) {
        matchedBank = {
          bank_name: (b as any).bankAccount.bankName,
          nickname: (b as any).bankAccount.nickname,
        } as any
      }
      if (!matchedBank) {
        matchedBank = fallbackBank
      }

      return {
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate,
        workOrderRef: b.workOrderRef,
        billingPeriod: b.billingPeriod,
        netReceivable: Number(b.netReceivable ?? 0),
        alreadyReceived: Number(b.alreadyReceived ?? 0),
        balanceDue: Number(b.balanceDue ?? 0),
        bankName: matchedBank?.bank_name ?? null,
        bankNickname: matchedBank?.nickname ?? null,
      }
    })
  }, [bills, bankAccounts, settings])

  const totalNet = useMemo(() => statementItems.reduce((s, i) => s + (Number(i.netReceivable) || 0), 0), [statementItems])
  const totalRec = useMemo(() => statementItems.reduce((s, i) => s + (Number(i.alreadyReceived) || 0), 0), [statementItems])
  const totalDue = useMemo(() => statementItems.reduce((s, i) => s + (Number(i.balanceDue) || 0), 0), [statementItems])
  const advanceAmount = Number(advances?.unallocatedAdvance ?? 0)
  const netPayable = Math.max(0, Math.round((totalDue - advanceAmount) * 100) / 100)

  async function handleDownloadPdf() {
    if (!selectedClient) return
    setGeneratingPdf(true)
    try {
      const doc = (
        <OutstandingStatementPdf
          business={{
            name: settings?.business_name ?? 'Sri Vaishnav Constructions',
            address: settings?.address ?? 'Godavarru, Kankipadu Mandal, Krishna Dist., AP',
            gstin: settings?.gstin ?? '37ABFPS9446D1ZM',
            pan: settings?.pan,
            state: settings?.state ?? 'Andhra Pradesh',
            state_code: settings?.state_code ?? '37',
            phone: settings?.phone,
            email: settings?.email,
            logo_url: settings?.logo_url ?? null,
            authorized_signatory: settings?.authorized_signatory ?? '',
          }}
          client={{
            name: selectedClient.name,
            gstin: selectedGstin?.gstin,
            address: selectedGstin?.address,
          }}
          banks={bankSummaries}
          statementDate={formatDateDisplay(new Date())}
          items={statementItems}
          unallocatedAdvance={advanceAmount}
        />
      )

      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Outstanding_Statement_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('Failed to generate statement PDF:', err)
      alert('Failed to generate statement PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  function handleCopyWhatsApp() {
    if (!selectedClient) return

    const lines: string[] = [
      `*${settings?.business_name ?? 'Sri Vaishnav Constructions'}*`,
      `*Statement of Outstanding Bills*`,
      `Client: ${selectedClient.name}`,
      `Date: ${formatDateDisplay(new Date())}`,
      ``,
    ]

    statementItems.forEach((item, idx) => {
      lines.push(`${idx + 1}. *${item.invoiceNumber}* (${item.invoiceDate})`)
      lines.push(`   Bill Net: ₹${fmt(item.netReceivable)} | Recd: ₹${fmt(item.alreadyReceived)} | *Due: ₹${fmt(item.balanceDue)}*`)
    })

    lines.push(``)
    lines.push(`*Total Pending Due: ₹${fmt(totalDue)}*`)
    if (advanceAmount > 0.01) {
      lines.push(`Less Advance on Account: -₹${fmt(advanceAmount)}`)
      lines.push(`*Net Balance Payable: ₹${fmt(netPayable)}*`)
    }
    lines.push(``)
    lines.push(`*Bank Remittance Details:*`)
    bankSummaries.forEach(b => {
      if (bankSummaries.length > 1) {
        lines.push(`\n*Account: ${b.bankName}* — *Due: ₹${fmt(b.totalDue)}*`)
        if (b.invoiceNumbers.length > 0) lines.push(`Bills: ${b.invoiceNumbers.join(', ')}`)
      } else {
        lines.push(`Bank: ${b.bankName}`)
        if (b.totalDue > 0) lines.push(`Pending Amount: ₹${fmt(b.totalDue)}`)
      }
      lines.push(`A/c Name: ${b.accountName}`)
      lines.push(`A/c No: ${b.accountNumber}`)
      lines.push(`IFSC: ${b.ifsc}`)
      if (b.branch) lines.push(`Branch: ${b.branch}`)
    })

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedWhatsApp(true)
    setTimeout(() => setCopiedWhatsApp(false), 3000)
  }

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

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
          maxWidth: 720,
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
              Client Statement Report
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'Playfair Display, serif', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Pending Bills Detail Sheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statement modal"
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

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Client Selector & Quick Stats Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--color-surface-offset)',
              padding: '14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                Select Client
              </label>
              <select
                value={selectedClientId ?? ''}
                onChange={e => setSelectedClientId(Number(e.target.value) || null)}
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
              >
                {clients.length === 0 ? (
                  <option value="">Loading clients…</option>
                ) : (
                  clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Quick Stat Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {loading ? 'Fetching records…' : `${statementItems.length} pending bill${statementItems.length === 1 ? '' : 's'} found`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>Total Pending:</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
                  ₹{fmt(totalDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Statement View Mode Bar (Cards vs Table) */}
          {statementItems.length > 0 && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)' }}>
                Unsettled Invoices
              </div>
              <div style={{ display: 'flex', background: 'var(--color-surface-offset)', padding: 2, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: viewMode === 'cards' ? '#fff' : 'transparent',
                    color: viewMode === 'cards' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: viewMode === 'cards' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  📋 Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: viewMode === 'table' ? '#fff' : 'transparent',
                    color: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: viewMode === 'table' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  📊 Table
                </button>
              </div>
            </div>
          )}

          {/* Statement Table or Card List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-faint)', fontSize: 13 }}>
              Loading statement data…
            </div>
          ) : statementItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--color-surface-offset)', borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>No Pending Bills!</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                All finalized bills for <b>{selectedClient?.name}</b> are fully cleared.
              </div>
              {advanceAmount > 0.01 && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>
                  Client has ₹{fmt(advanceAmount)} unallocated advance balance.
                </div>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* ─── Mobile-First Card View (No Horizontal Clipping) ─── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statementItems.map((item, idx) => (
                <div
                  key={item.invoiceNumber}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    padding: '12px 14px',
                    boxShadow: '0 1px 4px rgba(43,31,21,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Card Top: Number & Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif' }}>
                        #{idx + 1} {item.invoiceNumber}
                      </span>
                      {item.bankNickname && (
                        <span style={{ fontSize: 10, background: 'rgba(200,169,106,0.18)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                          {item.bankNickname}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      📅 {item.invoiceDate}
                    </span>
                  </div>

                  {/* Context / Period / Work Order if present */}
                  {(item.workOrderRef || item.billingPeriod) && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {item.billingPeriod && <span>Period: {item.billingPeriod}</span>}
                      {item.billingPeriod && item.workOrderRef && <span> &bull; </span>}
                      {item.workOrderRef && <span>WO: {item.workOrderRef}</span>}
                    </div>
                  )}

                  {/* 3-Column Financial Stat Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      background: 'var(--color-surface-offset)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Net Bill</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{fmt(item.netReceivable)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Received</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{fmt(item.alreadyReceived)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Balance Due</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{fmt(item.balanceDue)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Card List Summary Footer */}
              <div
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  Total Pending ({statementItems.length} bills)
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)' }}>
                  Due: ₹{fmt(totalDue)}
                </div>
              </div>
            </div>
          ) : (
            /* ─── Scrollable Table View (Horizontal Scroll Enabled) ─── */
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Invoice</th>
                    <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Net Bill</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Received</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {statementItems.map(item => (
                    <tr key={item.invoiceNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        {item.invoiceNumber}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {item.invoiceDate}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        ₹{fmt(item.netReceivable)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                        ₹{fmt(item.alreadyReceived)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)', whiteSpace: 'nowrap' }}>
                        ₹{fmt(item.balanceDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--color-surface-offset)', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '10px' }}>Total Pending ({statementItems.length} bills)</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>₹{fmt(totalNet)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: 'var(--color-success)' }}>₹{fmt(totalRec)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: 'var(--color-warning)' }}>₹{fmt(totalDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Bank Accounts Breakdown */}
          {statementItems.length > 0 && (
            <div style={{ background: 'var(--color-surface-offset)', borderRadius: 12, border: '1px solid var(--color-border)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', marginBottom: 8 }}>
                {bankSummaries.length > 1 ? '🏦 Remittance Bank Accounts (By Bill)' : '🏦 Remittance Bank Account'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
                {bankSummaries.map((b, idx) => (
                  <div key={b.accountNumber + idx} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--color-border)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        {b.bankName}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{fmt(b.totalDue)}
                      </div>
                    </div>
                    {b.invoiceNumbers.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                        Bills: {b.invoiceNumbers.join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      <div><b>A/c:</b> {b.accountNumber}</div>
                      <div><b>IFSC:</b> {b.ifsc}</div>
                      <div><b>Name:</b> {b.accountName}</div>
                      {b.branch && <div><b>Branch:</b> {b.branch}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advance Note if any */}
          {advanceAmount > 0.01 && (
            <div
              style={{
                background: 'rgba(200, 169, 106, 0.14)',
                border: '1px solid var(--color-accent)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                💎 <b>Advance Credit on File:</b> ₹{fmt(advanceAmount)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                Net Payable: ₹{fmt(netPayable)}
              </div>
            </div>
          )}

          {/* Action Buttons: PDF Download + WhatsApp Copy (Mobile-Friendly Stack/Row) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 4,
              paddingTop: 8,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                disabled={statementItems.length === 0}
                style={{
                  flex: '1 1 180px',
                  minHeight: 46,
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--color-success)',
                  background: copiedWhatsApp ? 'var(--color-success)' : 'transparent',
                  color: copiedWhatsApp ? '#fff' : 'var(--color-success)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: statementItems.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: statementItems.length === 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 180ms',
                }}
              >
                <span style={{ fontSize: 16 }}>💬</span>
                <span>{copiedWhatsApp ? 'Copied to Clipboard! ✓' : 'Copy for WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={generatingPdf || statementItems.length === 0}
                style={{
                  flex: '1 1 200px',
                  minHeight: 46,
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: generatingPdf || statementItems.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: generatingPdf || statementItems.length === 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 3px 12px rgba(59,42,31,0.25)',
                  transition: 'all 180ms',
                }}
              >
                <span style={{ fontSize: 16 }}>📄</span>
                <span>{generatingPdf ? 'Generating PDF…' : 'Download Statement PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body

  )
}
