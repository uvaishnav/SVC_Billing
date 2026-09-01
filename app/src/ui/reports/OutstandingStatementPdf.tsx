import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
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

// ── Font registration ─────────────────────────────────────────────────────────
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-400-normal.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-500-normal.ttf', fontWeight: 500, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-600-normal.ttf', fontWeight: 600, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-700-normal.ttf', fontWeight: 700, fontStyle: 'normal' },
  ],
})

Font.register({
  family: 'Lora',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@5/latin-400-normal.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@5/latin-700-normal.ttf', fontWeight: 700, fontStyle: 'normal' },
  ],
})

// ── Page constants ────────────────────────────────────────────────────────────
const PAGE_MARGIN = 32
const BODY_FONT = 'Inter'
const HEAD_FONT = 'Lora'

const HEADER_PADDING_V = 0
const LOGO_SIZE = 100
const LOGO_MARGIN = 0
const GSTIN_STRIP_BORDER = '#9E865A'

export interface StatementBankSummary {
  bankId?: number | null
  accountName: string
  bankName: string
  accountNumber: string
  ifsc: string
  branch?: string | null
  nickname?: string | null
  totalDue: number
  billsCount: number
  invoiceNumbers: string[]
}

export interface StatementItem {
  invoiceNumber: string
  invoiceDate: string
  workOrderRef: string | null
  billingPeriod: string
  netReceivable: number
  alreadyReceived: number
  balanceDue: number
  bankName?: string | null
  bankNickname?: string | null
}

export interface StatementPdfProps {
  business: {
    name: string
    address: string
    gstin: string
    pan?: string | null
    state?: string | null
    state_code?: string | null
    phone?: string | null
    email?: string | null
    logo_url?: string | null
    authorized_signatory?: string | null
  }
  client: {
    name: string
    gstin?: string | null
    address?: string | null
  }
  banks: StatementBankSummary[]
  statementDate: string
  items: StatementItem[]
  unallocatedAdvance: number
}

const styles = StyleSheet.create({
  page: {
    fontFamily: BODY_FONT,
    fontSize: 8,
    color: BODY_TEXT,
    backgroundColor: WHITE,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN + 12,
    paddingHorizontal: PAGE_MARGIN,
    lineHeight: 1.4,
  },

  // ── Header (matches InvoicePdf) ───────────────────────────────────────────
  header: {
    backgroundColor: CREAM,
    paddingVertical: HEADER_PADDING_V,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoWrap: {
    margin: LOGO_MARGIN,
    marginRight: 0,
    marginLeft: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerLogo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    objectFit: 'contain',
  },
  headerLogoPlaceholder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    backgroundColor: '#E8E2D8',
    borderRadius: 4,
  },
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBusinessName: {
    fontFamily: HEAD_FONT,
    fontSize: 18,
    fontWeight: 700,
    color: ESPRESSO,
    lineHeight: 1.0,
    marginBottom: 4,
  },
  headerAddress: {
    fontSize: 7.5,
    color: BODY_TEXT,
    lineHeight: 1.2,
    marginBottom: 5,
  },
  headerMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  headerMetaItem: {
    fontSize: 7.4,
    fontWeight: 500,
    color: MUTED,
  },
  headerMetaDivider: {
    fontSize: 7.4,
    color: DIVIDER,
    marginHorizontal: 4,
  },

  // ── GSTIN Strip ───────────────────────────────────────────────────────────
  gstinStrip: {
    backgroundColor: ESPRESSO,
    marginTop: -14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: GSTIN_STRIP_BORDER,
  },
  gstinStripText: {
    fontSize: 8.5,
    fontWeight: 700,
    color: CREAM,
    letterSpacing: 2,
  },
  gstinStripSpacer: {
    fontSize: 8.5,
    fontWeight: 400,
    color: GSTIN_STRIP_BORDER,
    marginHorizontal: 6,
  },

  // ── Statement Stamp ───────────────────────────────────────────────────────
  statementStamp: {
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1.25,
    borderBottomColor: DIVIDER,
    marginBottom: 12,
  },
  statementStampText: {
    fontFamily: HEAD_FONT,
    fontSize: 11,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 2,
  },
  statementStampDate: {
    fontSize: 7.5,
    fontWeight: 600,
    color: MUTED,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // ── Client & Meta Cards ───────────────────────────────────────────────────
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontSize: 7.5,
    fontWeight: 700,
    color: ESPRESSO,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: 9.5,
    fontWeight: 700,
    color: BODY_TEXT,
    marginBottom: 2,
  },
  cardText: {
    fontSize: 7.5,
    color: BODY_TEXT,
    lineHeight: 1.3,
  },

  // ── Table ─────────────────────────────────────────────────────────────────
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
    fontSize: 7.2,
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
    fontSize: 7.5,
    color: BODY_TEXT,
  },
  bankSubTag: {
    fontSize: 6.5,
    color: MUTED,
    marginTop: 1,
  },

  // Column widths (Total = 100%)
  colSl: { width: '4%' },
  colInv: { width: '22%' },
  colDate: { width: '12%' },
  colWo: { width: '14%' },
  colPeriod: { width: '18%' },
  colNet: { width: '10%', textAlign: 'right' },
  colRec: { width: '10%', textAlign: 'right' },
  colDue: { width: '10%', textAlign: 'right', fontWeight: 700 },

  // ── Summary & Remittance Section ──────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bankBlock: {
    width: '56%',
    backgroundColor: CREAM,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: DIVIDER,
    padding: 8,
  },
  bankItem: {
    marginTop: 4,
  },
  bankItemBorder: {
    borderTopWidth: 0.8,
    borderTopColor: DIVIDER,
    paddingTop: 6,
    marginTop: 6,
  },
  bankItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  bankItemName: {
    fontSize: 8.5,
    fontWeight: 700,
    color: ESPRESSO,
  },
  bankItemDue: {
    fontSize: 8,
    fontWeight: 700,
    color: ESPRESSO,
    backgroundColor: '#EFE7DA',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  bankBillsList: {
    fontSize: 7,
    color: MUTED,
    marginBottom: 3,
  },
  bankHighlight: {
    fontWeight: 700,
    color: ESPRESSO,
  },

  // ── Totals Box ────────────────────────────────────────────────────────────
  totalsBlock: {
    width: '40%',
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
    fontSize: 7.5,
    color: MUTED,
  },
  totalsVal: {
    fontSize: 7.5,
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
    fontSize: 8.5,
    fontWeight: 700,
    color: ESPRESSO,
  },
  grandTotalVal: {
    fontSize: 9.5,
    fontWeight: 700,
    color: ESPRESSO,
  },

  // ── Signatory ─────────────────────────────────────────────────────────────
  signatoryBlock: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatoryInner: {
    width: 190,
    textAlign: 'center',
    paddingTop: 32,
    borderTopWidth: 0.8,
    borderTopColor: DIVIDER,
  },
  signatoryText: {
    fontSize: 7.5,
    fontWeight: 700,
    color: ESPRESSO,
  },
  signatorySub: {
    fontSize: 7,
    color: MUTED,
    marginTop: 2,
  },
  signatoryName: {
    fontSize: 7.5,
    fontWeight: 600,
    color: BODY_TEXT,
    marginTop: 2,
  },
})

function HeaderBand({ business }: { business: StatementPdfProps['business'] }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLogoWrap}>
        {business.logo_url ? (
          <Image src={business.logo_url} style={styles.headerLogo} />
        ) : (
          <View style={styles.headerLogoPlaceholder} />
        )}
      </View>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerBusinessName}>{business.name}</Text>
        <Text style={styles.headerAddress}>{business.address}</Text>
        <View style={styles.headerMetaLine}>
          {business.pan ? (
            <>
              <Text style={styles.headerMetaItem}>PAN: {business.pan}</Text>
              <Text style={styles.headerMetaDivider}>|</Text>
            </>
          ) : null}
          {business.state ? (
            <>
              <Text style={styles.headerMetaItem}>
                State: {business.state} {business.state_code ? `(${business.state_code})` : ''}
              </Text>
              <Text style={styles.headerMetaDivider}>|</Text>
            </>
          ) : null}
          {business.phone ? (
            <>
              <Text style={styles.headerMetaItem}>Ph: {business.phone}</Text>
              {business.email ? <Text style={styles.headerMetaDivider}>|</Text> : null}
            </>
          ) : null}
          {business.email ? (
            <Text style={styles.headerMetaItem}>{business.email}</Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

function GstinStrip({ gstin }: { gstin: string }) {
  return (
    <View style={styles.gstinStrip}>
      <Text style={styles.gstinStripText}>GSTIN</Text>
      <Text style={styles.gstinStripSpacer}>·</Text>
      <Text style={styles.gstinStripText}>{gstin}</Text>
    </View>
  )
}

function StatementStamp({ statementDate }: { statementDate: string }) {
  return (
    <View style={styles.statementStamp}>
      <Text style={styles.statementStampText}>STATEMENT OF OUTSTANDING BILLS</Text>
      <Text style={styles.statementStampDate}>AS ON: {statementDate}</Text>
    </View>
  )
}

export function OutstandingStatementPdf({
  business,
  client,
  banks,
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
        {/* 1. Header Band (matches Tax Invoice PDF) */}
        <HeaderBand business={business} />

        {/* 2. Full-width ESPRESSO GSTIN strip */}
        <GstinStrip gstin={business.gstin} />

        {/* 3. Title Stamp */}
        <StatementStamp statementDate={statementDate} />

        {/* 4. Recipient and Meta Info */}
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

        {/* 5. Outstanding Invoices Table */}
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
              wrap={false}
              style={[
                styles.tableRow,
                { backgroundColor: idx % 2 === 1 ? CREAM : WHITE },
              ]}
            >
              <Text style={[styles.td, styles.colSl]}>{idx + 1}</Text>
              <View style={styles.colInv}>
                <Text style={[styles.td, { fontWeight: 600 }]}>{item.invoiceNumber}</Text>
                {(item.bankNickname || item.bankName) && (
                  <Text style={styles.bankSubTag}>
                    {item.bankNickname ? `[${item.bankNickname}]` : `[${item.bankName}]`}
                  </Text>
                )}
              </View>
              <Text style={[styles.td, styles.colDate]}>{item.invoiceDate}</Text>
              <Text style={[styles.td, styles.colWo]}>{item.workOrderRef ?? '—'}</Text>
              <Text style={[styles.td, styles.colPeriod]}>{item.billingPeriod}</Text>
              <Text style={[styles.td, styles.colNet]}>{formatCurrency(item.netReceivable)}</Text>
              <Text style={[styles.td, styles.colRec]}>{formatCurrency(item.alreadyReceived)}</Text>
              <Text style={[styles.td, styles.colDue, { color: ESPRESSO }]}>{formatCurrency(item.balanceDue)}</Text>
            </View>
          ))}
        </View>

        {/* 6. Bank Details (Grouped by Bill) & Totals Summary */}
        <View style={styles.summaryRow} wrap={false}>
          <View style={styles.bankBlock}>
            <Text style={styles.cardTitle}>
              {banks.length > 1 ? 'Remittance Bank Accounts (By Bill)' : 'Remittance / Bank Account Details'}
            </Text>
            {banks.map((b, idx) => (
              <View
                key={b.accountNumber + idx}
                style={[
                  styles.bankItem,
                  idx > 0 ? styles.bankItemBorder : undefined,
                ]}
              >
                <View style={styles.bankItemHeader}>
                  <Text style={styles.bankItemName}>
                    {b.bankName} {b.nickname ? `(${b.nickname})` : ''}
                  </Text>
                  <Text style={styles.bankItemDue}>
                    Due: ₹{formatCurrency(b.totalDue)}
                  </Text>
                </View>
                {b.invoiceNumbers.length > 0 && (
                  <Text style={styles.bankBillsList}>
                    For Bills: {b.invoiceNumbers.join(', ')}
                  </Text>
                )}
                <Text style={styles.cardText}>A/c Name: {b.accountName}</Text>
                <Text style={styles.cardText}>
                  A/c No: <Text style={styles.bankHighlight}>{b.accountNumber}</Text>   |   IFSC: <Text style={styles.bankHighlight}>{b.ifsc}</Text>
                </Text>
                {b.branch ? <Text style={styles.cardText}>Branch: {b.branch}</Text> : null}
              </View>
            ))}
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

        {/* 7. Signatory */}
        <View style={styles.signatoryBlock} wrap={false}>
          <View style={styles.signatoryInner}>
            <Text style={styles.signatoryText}>For {business.name}</Text>
            <Text style={styles.signatorySub}>Authorized Signatory</Text>
            {business.authorized_signatory ? (
              <Text style={styles.signatoryName}>{business.authorized_signatory}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  )
}
