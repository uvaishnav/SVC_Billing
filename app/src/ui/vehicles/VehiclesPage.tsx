import { useEffect, useState, useCallback } from 'react'
import type { Vehicle } from '../../db/types'
import { getVehicles, deactivateVehicle } from '../../db/vehiclesDb'
import VehicleCard from './VehicleCard'
import VehicleFormModal from './VehicleFormModal'
import VehicleDetailSheet from './VehicleDetailSheet'
import { sectionTitleStyle } from '../settings/_components'

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

  function handleAdd() {
    setEditingVehicle(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingVehicle(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Sticky header */}
      <div style={{
        background: 'var(--topbar-bg)',
        padding: 'calc(14px + var(--safe-top)) calc(20px + var(--safe-right)) 16px calc(20px + var(--safe-left))',
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(200,169,106,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-text-inverse)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Vehicles</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {vehicles.length} active vehicle{vehicles.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '24px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}
          >+</button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by reg number or type…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-text-inverse)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px calc(16px + var(--safe-right)) 32px calc(16px + var(--safe-left))' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading vehicles…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>🚛</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No vehicles matching "${search}"` : 'No vehicles yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first vehicle.</p>}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Vehicles'}
            </p>
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
          </>
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
