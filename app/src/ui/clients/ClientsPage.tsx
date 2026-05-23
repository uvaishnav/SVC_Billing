import React, { useEffect, useState, useCallback } from 'react'
import type { ClientWithGstins } from '../../db/types'
import { getClients, deactivateClient } from '../../db/clientsDb'
import ClientCard from './ClientCard'
import ClientFormModal from './ClientFormModal'
import { sectionTitleStyle } from '../settings/_components'

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithGstins[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientWithGstins | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getClients()
    setClients(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.gstins.some(g => g.gstin.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleDeactivate(id: number) {
    if (!confirm('Remove this client? This action cannot be undone.')) return
    await deactivateClient(id)
    load()
  }

  function handleEdit(client: ClientWithGstins) {
    setEditingClient(client)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingClient(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingClient(null)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Sticky header */}
      <div style={{
        background: 'var(--color-primary)',
        padding: '20px 20px 16px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Clients</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {clients.length} active client{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{
              width: '44px', height: '44px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              color: 'var(--color-primary)',
              fontSize: '24px', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              flexShrink: 0,
            }}
          >+</button>
        </div>

        {/* Search bar */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or GSTIN…"
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: '10px',
            border: 'none',
            background: 'rgba(255,255,255,0.12)',
            color: 'var(--color-bg)',
            fontSize: '15px',
            outline: 'none',
            fontFamily: 'Work Sans, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--color-surface-offset)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '28px',
            }}>👤</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No clients matching "${search}"` : 'No clients yet.'}
            </p>
            {!search && (
              <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first client.</p>
            )}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Clients'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(c => (
                <ClientCard
                  key={c.id}
                  client={c}
                  onEdit={handleEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <ClientFormModal
          client={editingClient}
          onClose={() => { setModalOpen(false); setEditingClient(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
