import { useState, useEffect, useCallback } from 'react'
import type { Vehicle } from '../../db/types'
import { getVehicles, deactivateVehicle } from '../../db/vehiclesDb'
import VehicleCard from './VehicleCard'
import VehicleFormModal from './VehicleFormModal'
import VehicleDetailSheet from './VehicleDetailSheet'

export default function VehiclesPage() {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-bg)', overflow: 'hidden' }}>

      {/* Page header */}
      <div className="page-header" style={{
        background: 'var(--color-primary)',
        paddingTop: 'calc(20px + var(--safe-top, 0px))',
        paddingBottom: '16px',
        paddingLeft: '20px',
        paddingRight: '20px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ color: 'var(--color-bg)', fontSize: '24px', fontFamily: 'Playfair Display, serif' }}>Vehicles</h1>
          <button
            type="button"
            aria-label="Add new vehicle"
            onClick={() => { setEditingVehicle(null); setModalOpen(true) }}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: 'none',
              color: '#fff', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
        <input
          type="search"
          placeholder="Search by registration or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: '12px',
            border: 'none', background: 'rgba(255,255,255,0.14)',
            color: '#fff', fontSize: '15px', fontFamily: 'Work Sans, sans-serif',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
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
