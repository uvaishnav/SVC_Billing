import { useEffect, useState, useMemo } from 'react'
import { pdf } from '@react-pdf/renderer'
import { getClients } from '../../db/clientsDb'
import { getSettings, getBankAccounts } from '../../db/settingsDb'
import type { ClientWithGstins, Settings, BankAccount } from '../../db/types'
import {
  getClientOutstandingBills,
  getClientAdvances,
  type ClientAdvancesResult
} from '../../db/paymentsDb'
import { OutstandingStatementPdf, type StatementItem } from './OutstandingStatementPdf'

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

  const activeBank = useMemo(() => {
    if (bankAccounts.length === 0) {
      return {
        accountName: settings?.business_name ?? 'Sri Vaishnav Constructions',
        bankName: 'State Bank of India',
        accountNumber: '—',
        ifsc: '—',
        branch: null,
      }
    }
    const defId = settings?.default_bank_account_id
    const found = bankAccounts.find(b => b.id === defId) ?? bankAccounts[0]
    return {
      accountName: found.account_name,
      bankName: found.bank_name,
      accountNumber: found.account_number,
      ifsc: found.ifsc,
      branch: found.branch,
    }
  }, [bankAccounts, settings])

  const statementItems: StatementItem[] = useMemo(() => {
    return bills.map(b => ({
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      workOrderRef: b.workOrderRef,
      billingPeriod: b.billingPeriod,
      netReceivable: Number(b.netReceivable ?? 0),
      alreadyReceived: Number(b.alreadyReceived ?? 0),
      balanceDue: Number(b.balanceDue ?? 0),
    }))
  }, [bills])

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
            phone: settings?.phone,
            email: settings?.email,
          }}
          client={{
            name: selectedClient.name,
            gstin: selectedGstin?.gstin,
            address: selectedGstin?.address,
          }}
          bank={activeBank}
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
    lines.push(`A/c Name: ${activeBank.accountName}`)
    lines.push(`Bank: ${activeBank.bankName}`)
    lines.push(`A/c No: ${activeBank.accountNumber}`)
    lines.push(`IFSC: ${activeBank.ifsc}`)
    if (activeBank.branch) lines.push(`Branch: ${activeBank.branch}`)

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedWhatsApp(true)
    setTimeout(() => setCopiedWhatsApp(false), 3000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(30, 20, 10, 0.65)',
        zIndex: 1000,
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
          maxWidth: 680,
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
              Client Statement Report
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'Playfair Display, serif', color: '#fff' }}>
              Pending Bills Detail Sheet
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

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Client Selector & Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
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
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: 14,
                  fontFamily: 'Work Sans, sans-serif',
                  outline: 'none',
                }}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ background: 'var(--color-surface-offset)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--color-border)', textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>Total Pending</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-warning)' }}>₹{fmt(totalDue)}</div>
              </div>
            </div>
          </div>

          {/* Statement Table */}
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
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '8px 10px' }}>Invoice</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Bill</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {statementItems.map(item => (
                    <tr key={item.invoiceNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {item.invoiceNumber}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>
                        {item.invoiceDate}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        ₹{fmt(item.netReceivable)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-success)' }}>
                        ₹{fmt(item.alreadyReceived)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>
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

          {/* Action Buttons: PDF Download + WhatsApp Copy */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={statementItems.length === 0}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: '1px solid var(--color-success)',
                background: copiedWhatsApp ? 'var(--color-success)' : 'transparent',
                color: copiedWhatsApp ? '#fff' : 'var(--color-success)',
                fontSize: 13,
                fontWeight: 700,
                cursor: statementItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: statementItems.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 180ms',
              }}
            >
              <span>💬</span>
              {copiedWhatsApp ? 'Copied to Clipboard! ✓' : 'Copy for WhatsApp'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf || statementItems.length === 0}
              style={{
                flex: 1.2,
                padding: '11px 0',
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
                gap: 6,
                boxShadow: '0 2px 8px rgba(59,42,31,0.25)',
              }}
            >
              <span>📄</span>
              {generatingPdf ? 'Generating PDF…' : 'Download Statement PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
