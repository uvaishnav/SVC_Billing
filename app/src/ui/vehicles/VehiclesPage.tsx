import { useState, useEffect, useCallback } from 'react'
import type { Vehicle } from '../../db/types'
import { getVehicles, deactivateVehicle } from '../../db/vehiclesDb'
import VehicleCard from './VehicleCard'
import VehicleFormModal from './VehicleFormModal'
import VehicleDetailSheet from './VehicleDetailSheet'

export default function VehiclesPage({ onBack }: { onBack?: () => void } = {}) {
  const [vehicles,       setVehicles]       = useState<Vehicle[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [detailVehicle,  setDetailVehicle]  = useState<Vehicle | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getVehicles()
    setVehicles(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = vehicles.filter(v =>
    v.reg_number.toLowerCase().includes(search.toLowerCase()) ||
    (v.vehicle_type ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDeactivate(id: number) {
    if (!confirm('Remove this vehicle? This action cannot be undone.')) return
    await deactivateVehicle(id)
    load()
  }

  function handleEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingVehicle(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to More"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <h1 style={{ color: 'var(--color-primary)', fontSize: '22px', fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Vehicles</h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '2px', fontFamily: 'Work Sans, sans-serif' }}>
                {vehicles.length} registered vehicle{vehicles.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Add new vehicle"
            onClick={() => { setEditingVehicle(null); setModalOpen(true) }}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--color-primary)', border: 'none',
              color: 'var(--color-bg)', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(59,42,31,0.18)',
              transition: 'all 150ms ease',
            }}
          >+</button>
        </div>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search by registration or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px',
              border: '1px solid rgba(59,42,31,0.12)', background: 'rgba(255,255,255,0.85)',
              color: 'var(--color-text)', fontSize: '13px', fontFamily: 'Work Sans, sans-serif',
              outline: 'none', boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(59,42,31,0.03)',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px', fontFamily: 'Work Sans, sans-serif' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px', fontFamily: 'Work Sans, sans-serif' }}>
            {search ? 'No vehicles match your search.' : 'No vehicles yet. Tap + to add one.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(v => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onTap={setDetailVehicle}
                onEdit={handleEdit}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => { setModalOpen(false); setEditingVehicle(null) }}
          onSaved={handleSaved}
        />
      )}

      {detailVehicle && (
        <VehicleDetailSheet
          vehicle={detailVehicle}
          onClose={() => setDetailVehicle(null)}
          onEdit={(v) => { setDetailVehicle(null); handleEdit(v) }}
        />
      )}
    </div>
  )
}
