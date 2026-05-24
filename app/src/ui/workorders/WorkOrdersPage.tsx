import React, { useEffect, useState, useCallback } from 'react'
import type { WorkOrderWithClient } from '../../db/types'
import { getWorkOrders, closeWorkOrder, computeWOStatus } from '../../db/workOrdersDb'
import { sectionTitleStyle } from '../settings/_components'
import WorkOrderCard from './WorkOrderCard'
import WorkOrderFormModal from './WorkOrderFormModal'
import WorkOrderDetailSheet from './WorkOrderDetailSheet'

export default function WorkOrdersPage() {
  const [workOrders,   setWorkOrders]   = useState<WorkOrderWithClient[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'closed'>('all')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingWO,    setEditingWO]    = useState<WorkOrderWithClient | null>(null)
  const [detailWO,     setDetailWO]     = useState<WorkOrderWithClient | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getWorkOrders()
    // Recompute live status client-side
    const withStatus = data.map(wo => ({ ...wo, status: computeWOStatus(wo) }))
    setWorkOrders(withStatus)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = workOrders.filter(wo => {
    const matchesSearch =
      (wo.wo_reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
      wo.subject.toLowerCase().includes(search.toLowerCase()) ||
      (wo.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (wo.project_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || wo.status === filterStatus
    return matchesSearch && matchesStatus
  })

  async function handleClose(id: number) {
    if (!confirm('Mark this work order as Closed? No further billing will be linked to it.')) return
    await closeWorkOrder(id)
    load()
  }

  function handleEdit(wo: WorkOrderWithClient) {
    setEditingWO(wo)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingWO(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingWO(null)
    load()
  }

  const statusFilters: { id: typeof filterStatus; label: string }[] = [
    { id: 'all',           label: 'All' },
    { id: 'active',        label: 'Active' },
    { id: 'expiring_soon', label: 'Expiring' },
    { id: 'expired',       label: 'Expired' },
    { id: 'closed',        label: 'Closed' },
  ]

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Sticky header */}
      <div style={{ background: 'var(--color-primary)', padding: '20px 20px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Work Orders</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {workOrders.filter(wo => wo.status === 'active' || wo.status === 'expiring_soon').length} active
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '24px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexShrink: 0 }}
          >+</button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by WO ref, subject, client…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', marginBottom: '12px' }}
        />

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '14px', scrollbarWidth: 'none' }}>
          {statusFilters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: filterStatus === f.id ? 'none' : '1px solid rgba(255,255,255,0.2)',
                background: filterStatus === f.id ? 'var(--color-accent)' : 'transparent',
                color: filterStatus === f.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                fontSize: '13px',
                fontWeight: filterStatus === f.id ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'Work Sans, sans-serif',
                flexShrink: 0,
              }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading work orders…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📋</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search || filterStatus !== 'all' ? 'No work orders match your filter.' : 'No work orders yet.'}
            </p>
            {!search && filterStatus === 'all' && (
              <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first work order.</p>
            )}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {filterStatus !== 'all' ? `${filtered.length} ${filterStatus.replace('_', ' ')}` : `${filtered.length} work order${filtered.length !== 1 ? 's' : ''}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(wo => (
                <WorkOrderCard
                  key={wo.id}
                  workOrder={wo}
                  onTap={setDetailWO}
                  onEdit={handleEdit}
                  onClose={handleClose}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <WorkOrderFormModal
          workOrder={editingWO}
          onClose={() => { setModalOpen(false); setEditingWO(null) }}
          onSaved={handleSaved}
        />
      )}

      {detailWO && (
        <WorkOrderDetailSheet
          workOrder={detailWO}
          onClose={() => setDetailWO(null)}
          onEdit={(wo) => { setDetailWO(null); handleEdit(wo) }}
          onRefresh={load}
        />
      )}
    </div>
  )
}
