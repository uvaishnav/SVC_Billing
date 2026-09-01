import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'
import {
  ESPRESSO,
  BODY_TEXT,
  MUTED,
  CREAM,
  DIVIDER,
  WHITE,
  GOLD_ACCENT,
  formatCurrency,
} from '../invoices/pdf/pdfUtils'

export interface StatementItem {
  invoiceNumber: string
  invoiceDate: string
  workOrderRef: string | null
  billingPeriod: string
  netReceivable: number
  alreadyReceived: number
  balanceDue: number
}

export interface StatementPdfProps {
  business: {
    name: string
    address: string
    gstin: string
    pan?: string | null
    phone?: string | null
    email?: string | null
  }
  client: {
    name: string
    gstin?: string | null
    address?: string | null
  }
  bank: {
    accountName: string
    bankName: string
    accountNumber: string
    ifsc: string
    branch?: string | null
  }
  statementDate: string
  items: StatementItem[]
  unallocatedAdvance: number
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontFamily: 'Inter',
    fontSize: 9,
    color: BODY_TEXT,
  },
  headerBox: {
    borderBottomWidth: 1.5,
    borderBottomColor: ESPRESSO,
    paddingBottom: 10,
    marginBottom: 12,
  },
  companyName: {
    fontFamily: 'Lora',
    fontSize: 17,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 0.3,
  },
  companySub: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
    lineHeight: 1.3,
  },
  docTitleBanner: {
    backgroundColor: ESPRESSO,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docTitleText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  docTitleDate: {
    color: '#D9D3C5',
    fontSize: 8,
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  clientCard: {
    width: '58%',
    backgroundColor: CREAM,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: DIVIDER,
    padding: 8,
  },
  metaCard: {
    width: '38%',
    backgroundColor: CREAM,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: DIVIDER,
    padding: 8,
  },
  cardTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: ESPRESSO,
    marginBottom: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: 10,
    fontWeight: 700,
    color: BODY_TEXT,
    marginBottom: 2,
  },
  cardText: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.3,
  },
  table: {
    borderWidth: 0.8,
    borderColor: DIVIDER,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ESPRESSO,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: {
    color: WHITE,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: DIVIDER,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 8,
    color: BODY_TEXT,
  },
  // Column widths
  colSl: { width: '5%' },
  colInv: { width: '22%' },
  colDate: { width: '13%' },
  colWo: { width: '16%' },
  colPeriod: { width: '16%' },
  colNet: { width: '14%', textAlign: 'right' },
  colRec: { width: '14%', textAlign: 'right' },
  colDue: { width: '14%', textAlign: 'right', fontWeight: 700 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bankBlock: {
    width: '54%',
    backgroundColor: CREAM,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: DIVIDER,
    padding: 8,
  },
  totalsBlock: {
    width: '42%',
    backgroundColor: CREAM,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: DIVIDER,
    padding: 8,
  },
  totalsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 8,
    color: MUTED,
  },
  totalsVal: {
    fontSize: 8,
    fontWeight: 600,
    color: BODY_TEXT,
  },
  grandTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: ESPRESSO,
    paddingTop: 4,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: ESPRESSO,
  },
  grandTotalVal: {
    fontSize: 10,
    fontWeight: 700,
    color: ESPRESSO,
  },
  signatoryBlock: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatoryInner: {
    width: 200,
    textAlign: 'center',
    paddingTop: 36,
    borderTopWidth: 0.8,
    borderTopColor: DIVIDER,
  },
  signatoryText: {
    fontSize: 8,
    fontWeight: 700,
    color: ESPRESSO,
  },
  signatorySub: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 2,
  },
})

export function OutstandingStatementPdf({
  business,
  client,
  bank,
  statementDate,
  items,
  unallocatedAdvance,
}: StatementPdfProps) {
  const totalNet = items.reduce((s, i) => s + i.netReceivable, 0)
  const totalRec = items.reduce((s, i) => s + i.alreadyReceived, 0)
  const totalDue = items.reduce((s, i) => s + i.balanceDue, 0)
  const netPayable = Math.max(0, Math.round((totalDue - unallocatedAdvance) * 100) / 100)

  return (
    <Document title={`Statement of Outstanding - ${client.name}`}>
      <Page size="A4" style={styles.page}>
        {/* 1. Header */}
        <View style={styles.headerBox}>
          <Text style={styles.companyName}>{business.name}</Text>
          <Text style={styles.companySub}>{business.address}</Text>
          <Text style={styles.companySub}>
            GSTIN: {business.gstin}
            {business.pan ? `  |  PAN: ${business.pan}` : ''}
            {business.phone ? `  |  Ph: ${business.phone}` : ''}
            {business.email ? `  |  Email: ${business.email}` : ''}
          </Text>
        </View>

        {/* 2. Document Title Banner */}
        <View style={styles.docTitleBanner}>
          <Text style={styles.docTitleText}>Statement of Pending / Uncleared Bills</Text>
          <Text style={styles.docTitleDate}>As on: {statementDate}</Text>
        </View>

        {/* 3. Recipient and Meta Info */}
        <View style={styles.twoCol}>
          <View style={styles.clientCard}>
            <Text style={styles.cardTitle}>Bill To / Client Details</Text>
            <Text style={styles.clientName}>{client.name}</Text>
            {client.gstin && <Text style={styles.cardText}>GSTIN: {client.gstin}</Text>}
            {client.address && <Text style={styles.cardText}>{client.address}</Text>}
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.cardTitle}>Summary Snapshot</Text>
            <Text style={styles.cardText}>Pending Invoices: {items.length}</Text>
            <Text style={styles.cardText}>Total Outstanding: ₹{formatCurrency(totalDue)}</Text>
            {unallocatedAdvance > 0.01 && (
              <Text style={{ ...styles.cardText, color: GOLD_ACCENT, fontWeight: 700 }}>
                Advance Balance: ₹{formatCurrency(unallocatedAdvance)}
              </Text>
            )}
          </View>
        </View>

        {/* 4. Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colSl]}>#</Text>
            <Text style={[styles.th, styles.colInv]}>Invoice No.</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colWo]}>W.O. Ref</Text>
            <Text style={[styles.th, styles.colPeriod]}>Period</Text>
            <Text style={[styles.th, styles.colNet]}>Net (₹)</Text>
            <Text style={[styles.th, styles.colRec]}>Recd (₹)</Text>
            <Text style={[styles.th, styles.colDue]}>Due (₹)</Text>
          </View>

          {items.map((item, idx) => (
            <View
              key={item.invoiceNumber}
              style={[
                styles.tableRow,
                { backgroundColor: idx % 2 === 1 ? CREAM : WHITE },
              ]}
            >
              <Text style={[styles.td, styles.colSl]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.colInv, { fontWeight: 600 }]}>{item.invoiceNumber}</Text>
              <Text style={[styles.td, styles.colDate]}>{item.invoiceDate}</Text>
              <Text style={[styles.td, styles.colWo]}>{item.workOrderRef ?? '—'}</Text>
              <Text style={[styles.td, styles.colPeriod]}>{item.billingPeriod}</Text>
              <Text style={[styles.td, styles.colNet]}>{formatCurrency(item.netReceivable)}</Text>
              <Text style={[styles.td, styles.colRec]}>{formatCurrency(item.alreadyReceived)}</Text>
              <Text style={[styles.td, styles.colDue, { color: ESPRESSO }]}>{formatCurrency(item.balanceDue)}</Text>
            </View>
          ))}
        </View>

        {/* 5. Bank Details & Totals Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.bankBlock}>
            <Text style={styles.cardTitle}>Remittance / Bank Account Details</Text>
            <Text style={styles.cardText}>Account Name: {bank.accountName}</Text>
            <Text style={styles.cardText}>Bank: {bank.bankName}</Text>
            <Text style={styles.cardText}>Account No: {bank.accountNumber}</Text>
            <Text style={styles.cardText}>IFSC: {bank.ifsc}</Text>
            {bank.branch && <Text style={styles.cardText}>Branch: {bank.branch}</Text>}
          </View>

          <View style={styles.totalsBlock}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Total Invoiced (Net):</Text>
              <Text style={styles.totalsVal}>₹{formatCurrency(totalNet)}</Text>
            </View>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Total Amount Received:</Text>
              <Text style={styles.totalsVal}>₹{formatCurrency(totalRec)}</Text>
            </View>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Total Pending Balance:</Text>
              <Text style={styles.totalsVal}>₹{formatCurrency(totalDue)}</Text>
            </View>
            {unallocatedAdvance > 0.01 && (
              <View style={styles.totalsLine}>
                <Text style={{ ...styles.totalsLabel, color: GOLD_ACCENT }}>Less Client Advance:</Text>
                <Text style={{ ...styles.totalsVal, color: GOLD_ACCENT }}>- ₹{formatCurrency(unallocatedAdvance)}</Text>
              </View>
            )}
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>Net Amount Payable:</Text>
              <Text style={styles.grandTotalVal}>₹{formatCurrency(netPayable)}</Text>
            </View>
          </View>
        </View>

        {/* 6. Signatory */}
        <View style={styles.signatoryBlock}>
          <View style={styles.signatoryInner}>
            <Text style={styles.signatoryText}>For {business.name}</Text>
            <Text style={styles.signatorySub}>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
