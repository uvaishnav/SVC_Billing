import React, { useState } from 'react'
import type { InvoiceDraft, Settings, BankAccount, SacCode } from '../../db/types'
import { computeTotals } from '../../db/invoicesDb'

function toWords(n: number): string {
  if (n === 0) return 'Zero Rupees Only'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function below100(n: number): string {
    return n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
  }
  function below1000(n: number): string {
    return n >= 100 ? ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + below100(n%100) : '') : below100(n)
  }
  const crore = Math.floor(n / 10000000)
  const lakh  = Math.floor((n % 10000000) / 100000)
  const thous = Math.floor((n % 100000) / 1000)
  const rem   = Math.floor(n % 1000)
  const paise = Math.round((n - Math.floor(n)) * 100)
  let result = ''
  if (crore) result += below1000(crore) + ' Crore '
  if (lakh)  result += below1000(lakh)  + ' Lakh '
  if (thous) result += below1000(thous) + ' Thousand '
  if (rem)   result += below1000(rem)
  result = result.trim() + ' Rupees'
  if (paise) result += ' and ' + below100(paise) + ' Paise'
  return result + ' Only'
}

interface Props {
  draft: InvoiceDraft
  settings: Settings
  bankAccount: BankAccount | null
  sacCode: SacCode | null
  tdsApplicable: boolean
  onSaveDraft: () => Promise<void>
  onFinalize: () => Promise<void>
  onBack: () => void
  saving: boolean
  finalizing: boolean
}

const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid rgba(200,169,106,0.1)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif',
}
const valueStyle: React.CSSProperties = {
  fontSize: '14px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif', fontWeight: 500,
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function Section4Review({
  draft, settings, bankAccount, sacCode, tdsApplicable,
  onSaveDraft, onFinalize, onBack, saving, finalizing,
}: Props) {
  const totals = computeTotals({ ...draft, tds_applicable: tdsApplicable })
  const cgst   = draft.tax_mode === 'cgst_sgst' ? totals.total_gst / 2 : 0
  const sgst   = draft.tax_mode === 'cgst_sgst' ? totals.total_gst / 2 : 0
  const igst   = draft.tax_mode === 'igst'       ? totals.total_gst    : 0

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Line Items Summary */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(200,169,106,0.15)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(200,169,106,0.15)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          Line Items
        </div>
        {draft.line_items.map((item, i) => (
          <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(200,169,106,0.08)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>{item.description}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
                {item.qty} {item.unit ?? ''} × {fmt(item.rate)}
                {item.rate_overridden && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>(⚠️ overridden)</span>}
              </div>
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-accent)', fontFamily: 'Work Sans, sans-serif', fontSize: '14px', whiteSpace: 'nowrap' }}>
              {fmt(item.taxable_value)}
            </div>
          </div>
        ))}
      </div>

      {/* Totals Block */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(200,169,106,0.15)',
        borderRadius: '10px',
        padding: '14px',
      }}>
        <div style={row}>
          <span style={labelStyle}>Taxable Value</span>
          <span style={valueStyle}>{fmt(totals.total_taxable)}</span>
        </div>
        {draft.tax_mode === 'cgst_sgst' ? (
          <>
            <div style={row}>
              <span style={labelStyle}>CGST @ {draft.gst_rate/2}%</span>
              <span style={valueStyle}>{fmt(cgst)}</span>
            </div>
            <div style={row}>
              <span style={labelStyle}>SGST @ {draft.gst_rate/2}%</span>
              <span style={valueStyle}>{fmt(sgst)}</span>
            </div>
          </>
        ) : (
          <div style={row}>
            <span style={labelStyle}>IGST @ {draft.gst_rate}%</span>
            <span style={valueStyle}>{fmt(igst)}</span>
          </div>
        )}
        {/* Total Invoice Amount */}
        <div style={{ ...row, paddingTop: '14px', borderBottom: 'none' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>Total Invoice Amount</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'Work Sans, sans-serif' }}>{fmt(totals.total_amount)}</span>
        </div>
        {/* TDS informational line */}
        {tdsApplicable && (
          <>
            <div style={{ ...row, opacity: 0.7 }}>
              <span style={{ ...labelStyle, fontStyle: 'italic' }}>TDS @ {draft.tds_rate}% (deducted by client)</span>
              <span style={{ ...valueStyle, fontStyle: 'italic' }}>- {fmt(totals.tds_amount)}</span>
            </div>
            <div style={row}>
              <span style={{ ...labelStyle, fontWeight: 600 }}>Net Receivable</span>
              <span style={{ ...valueStyle, fontWeight: 700, color: '#22c55e' }}>{fmt(totals.net_receivable)}</span>
            </div>
          </>
        )}
      </div>

      {/* Amount in words */}
      <div style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(200,169,106,0.1)',
        borderRadius: '8px',
        fontSize: '12px', fontStyle: 'italic',
        color: 'var(--color-text-faint)',
        fontFamily: 'Work Sans, sans-serif',
        lineHeight: '1.5',
      }}>
        {toWords(totals.total_amount)}
      </div>

      {/* Bank Details */}
      {bankAccount && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(200,169,106,0.15)',
          borderRadius: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Payment Bank</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif', lineHeight: '1.8' }}>
            {bankAccount.bank_name} — {bankAccount.account_name}<br />
            A/c: {bankAccount.account_number} | IFSC: {bankAccount.ifsc}
            {bankAccount.branch && <><br />Branch: {bankAccount.branch}</>}
          </div>
        </div>
      )}

      {/* Description preview */}
      {draft.overall_description && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(200,169,106,0.1)',
          borderRadius: '8px',
          fontSize: '13px', color: 'var(--color-text-faint)',
          fontFamily: 'Work Sans, sans-serif', lineHeight: '1.5', fontStyle: 'italic',
        }}>
          “{draft.overall_description}”
        </div>
      )}

      {/* Navigation */}
      <button onClick={onBack} style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(200,169,106,0.2)',
        borderRadius: '10px', color: 'var(--color-text-faint)',
        fontSize: '14px', fontFamily: 'Work Sans, sans-serif', cursor: 'pointer',
      }}>← Back</button>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onSaveDraft}
          disabled={saving || finalizing}
          style={{
            flex: 1, padding: '14px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(200,169,106,0.3)',
            borderRadius: '10px', color: 'var(--color-accent)',
            fontSize: '14px', fontWeight: 600,
            fontFamily: 'Work Sans, sans-serif',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : '💾 Save Draft'}
        </button>
        <button
          onClick={onFinalize}
          disabled={saving || finalizing}
          style={{
            flex: 2, padding: '14px',
            background: finalizing ? 'rgba(255,255,255,0.05)' : 'var(--color-accent)',
            color: finalizing ? 'var(--color-text-faint)' : 'var(--color-primary)',
            border: 'none', borderRadius: '10px',
            fontSize: '14px', fontWeight: 700,
            fontFamily: 'Work Sans, sans-serif',
            cursor: finalizing ? 'default' : 'pointer',
          }}
        >
          {finalizing ? 'Finalizing…' : '✅ Finalize Invoice'}
        </button>
      </div>
    </div>
  )
}
