import React, { useCallback, useEffect, useState } from 'react'
import type {
  InvoiceDraft, Client, ClientGstin, WorkOrder, WorkOrderItem,
  Vehicle, SacCode, BankAccount, Settings,
} from '../../db/types'
import { generateInvoiceNumber } from '../../utils/invoiceNumbering'
import { getClients, getClientGstins } from '../../db/clientsDb'
import { getWorkOrdersByClient, getWorkOrderItems } from '../../db/workOrdersDb'
import { getVehicles } from '../../db/vehiclesDb'
import { getSettings, getSacCodes, getBankAccounts } from '../../db/settingsDb'
import { saveInvoiceDraft, finalizeInvoice } from '../../db/invoicesDb'
import WizardNav, { type SectionId } from './WizardNav'
import Section1Header from './Section1Header'
import Section2Items from './Section2Items'
import Section3Description from './Section3Description'
import Section4Review from './Section4Review'

function prevMonthRange() {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to   = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt  = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(from), to: fmt(to) }
}

const DEFAULT_DRAFT = (): Omit<InvoiceDraft, 'invoice_number'> => {
  const { from, to } = prevMonthRange()
  return {
    client_id: null, client_gstin_id: null,
    tax_mode: 'cgst_sgst',
    invoice_date: new Date().toISOString().split('T')[0],
    billing_from: from, billing_to: to,
    work_order_id: null, sac_id: null, bank_account_id: null,
    line_items: [], vehicles: [],
    overall_description: '',
    total_taxable: 0, gst_rate: 18,
    total_gst: 0, total_amount: 0,
    tds_rate: 2, tds_amount: 0, net_receivable: 0,
    sectionsVisited: [1], sectionsDone: [],
  }
}

interface Props {
  onClose: () => void
  onFinalized: () => void
}

export default function InvoiceWizard({ onClose, onFinalized }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>(1)
  const [draft, setDraft] = useState<InvoiceDraft | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [clientGstins, setClientGstins] = useState<ClientGstin[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [woItems, setWoItems] = useState<WorkOrderItem[]>([])
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [sacCodes, setSacCodes] = useState<SacCode[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  // Init: load settings, generate invoice number, load reference data
  useEffect(() => {
    async function init() {
      const [s, cls, vehs, sacs, banks] = await Promise.all([
        getSettings(),
        getClients(),
        getVehicles(),
        getSacCodes(),
        getBankAccounts(),
      ])
      if (!s) { setInitError('Could not load settings. Please complete settings first.'); return }

      let invoiceNumber = ''
      try {
        invoiceNumber = await generateInvoiceNumber()
      } catch {
        setInitError('Could not generate invoice number. Check your connection.')
        return
      }

      setSettings(s)
      setClients(cls)
      setAllVehicles(vehs.filter(v => v.is_active))
      setSacCodes(sacs)
      setBankAccounts(banks)

      const def = DEFAULT_DRAFT()
      setDraft({
        ...def,
        invoice_number: invoiceNumber,
        sac_id:          s.default_sac_id,
        bank_account_id: s.default_bank_account_id,
        tds_rate:        s.default_tds_rate,
      })
    }
    init()
  }, [])

  const patchDraft = useCallback((patch: Partial<InvoiceDraft>) => {
    setDraft(prev => prev ? { ...prev, ...patch } : prev)
  }, [])

  async function loadGstins(clientId: number) {
    const gstins = await getClientGstins(clientId)
    setClientGstins(gstins)
    // Auto-select primary
    const primary = gstins.find(g => g.is_primary)
    if (primary) {
      const taxMode = settings?.state_code
        ? (primary.state_code.trim() === settings.state_code.trim() ? 'cgst_sgst' : 'igst')
        : 'cgst_sgst'
      patchDraft({ client_gstin_id: primary.id, tax_mode: taxMode })
    }
  }

  async function loadWorkOrders(clientId: number) {
    const wos = await getWorkOrdersByClient(clientId)
    setWorkOrders(wos)
  }

  async function loadWoItems(workOrderId: number) {
    const items = await getWorkOrderItems(workOrderId)
    setWoItems(items)
  }

  // When WO changes, load its items
  useEffect(() => {
    if (draft?.work_order_id) loadWoItems(draft.work_order_id)
    else setWoItems([])
  }, [draft?.work_order_id])

  function markSectionDone(section: SectionId) {
    setDraft(prev => {
      if (!prev) return prev
      const visited = prev.sectionsVisited.includes(section) ? prev.sectionsVisited : [...prev.sectionsVisited, section]
      const done    = prev.sectionsDone.includes(section)   ? prev.sectionsDone   : [...prev.sectionsDone, section]
      return { ...prev, sectionsVisited: visited, sectionsDone: done }
    })
  }

  function goToSection(s: SectionId) {
    setDraft(prev => {
      if (!prev) return prev
      const visited = prev.sectionsVisited.includes(s) ? prev.sectionsVisited : [...prev.sectionsVisited, s]
      return { ...prev, sectionsVisited: visited }
    })
    setActiveSection(s)
  }

  function handleNext(from: SectionId) {
    markSectionDone(from)
    const next = (from + 1) as SectionId
    goToSection(next)
  }

  async function handleSaveDraft() {
    if (!draft || !settings) return
    setSaving(true)
    const tdsApplicable = workOrders.find(w => w.id === draft.work_order_id)?.tds_applicable ?? false
    await saveInvoiceDraft(draft, tdsApplicable)
    setSaving(false)
  }

  async function handleFinalize() {
    if (!draft || !settings) return
    setFinalizing(true)
    const tdsApplicable = workOrders.find(w => w.id === draft.work_order_id)?.tds_applicable ?? false
    const ok = await finalizeInvoice(draft, tdsApplicable)
    setFinalizing(false)
    if (ok) onFinalized()
  }

  const selectedWO       = workOrders.find(w => w.id === draft?.work_order_id)
  const ratesFirm        = selectedWO?.rates_firm ?? false
  const tdsApplicable    = selectedWO?.tds_applicable ?? false
  const clientName       = clients.find(c => c.id === draft?.client_id)?.name ?? ''
  const bankAccount      = bankAccounts.find(b => b.id === draft?.bank_account_id) ?? null
  const sacCode          = sacCodes.find(s => s.id === draft?.sac_id) ?? null

  if (initError) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#dc503c', fontFamily: 'Work Sans, sans-serif' }}>
        <div style={{ fontSize: '16px', marginBottom: '12px' }}>{initError}</div>
        <button onClick={onClose} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(200,169,106,0.2)', borderRadius: '8px', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Close</button>
      </div>
    )
  }

  if (!draft || !settings) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
        Initialising invoice…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 0',
        background: 'var(--color-primary)',
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--color-text-faint)',
          fontSize: '14px', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif',
          padding: '4px 0',
        }}>← Cancel</button>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>
          New Invoice
        </span>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          style={{
            background: 'none', border: 'none',
            color: saving ? 'var(--color-text-faint)' : 'var(--color-accent)',
            fontSize: '13px', fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            fontFamily: 'Work Sans, sans-serif',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Section nav */}
      <WizardNav
        activeSection={activeSection}
        sectionsVisited={draft.sectionsVisited}
        sectionsDone={draft.sectionsDone}
        onNavigate={goToSection}
      />

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '24px' }}>
        {activeSection === 1 && (
          <Section1Header
            draft={draft}
            settings={settings}
            clients={clients}
            clientGstins={clientGstins}
            workOrders={workOrders}
            sacCodes={sacCodes}
            bankAccounts={bankAccounts}
            onLoadGstins={loadGstins}
            onLoadWorkOrders={loadWorkOrders}
            onChange={patchDraft}
            onNext={() => handleNext(1)}
          />
        )}
        {activeSection === 2 && (
          <Section2Items
            draft={draft}
            woItems={woItems}
            ratesFirm={ratesFirm}
            onChange={patchDraft}
            onNext={() => handleNext(2)}
            onBack={() => goToSection(1)}
          />
        )}
        {activeSection === 3 && (
          <Section3Description
            draft={draft}
            allVehicles={allVehicles}
            clientName={clientName}
            woSubject={selectedWO?.subject}
            woReference={selectedWO?.wo_reference ?? undefined}
            onChange={patchDraft}
            onNext={() => handleNext(3)}
            onBack={() => goToSection(2)}
          />
        )}
        {activeSection === 4 && (
          <Section4Review
            draft={draft}
            settings={settings}
            bankAccount={bankAccount}
            sacCode={sacCode}
            tdsApplicable={tdsApplicable}
            onSaveDraft={handleSaveDraft}
            onFinalize={handleFinalize}
            onBack={() => goToSection(3)}
            saving={saving}
            finalizing={finalizing}
          />
        )}
      </div>
    </div>
  )
}
