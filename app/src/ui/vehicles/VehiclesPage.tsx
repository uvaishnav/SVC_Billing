import { useEffect, useState, useCallback } from 'react'
import type { VehicleWithClient } from '../../db/types'
import { getVehicles, deactivateVehicle } from '../../db/vehiclesDb'
import { sectionTitleStyle } from '../settings/_components'
import VehicleCard from './VehicleCard'
import VehicleFormModal from './VehicleFormModal'

export default function VehiclesPage() {
  const [vehicles,       setVehicles]       = useState<VehicleWithClient[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithClient | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getVehicles()
    setVehicles(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = vehicles.filter(v =>
    (v.registration_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (v.make ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (v.model ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (v.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDeactivate(id: number) {
    if (!confirm('Archive this vehicle? It will no longer appear in active lists.')) return
    await deactivateVehicle(id)
    load()
  }

  function handleEdit(vehicle: VehicleWithClient) {
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

      <div className="page-header" style={{ background: 'var(--color-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Vehicles</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
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
          placeholder="Search by plate, make, model, or client…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
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
                  onEdit={handleEdit}
                  onDelete={handleDeactivate}
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
    </div>
  )
}
