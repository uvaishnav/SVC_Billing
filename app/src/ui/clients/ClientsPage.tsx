import { useEffect, useState, useCallback } from 'react'
import type { Client } from '../../db/types'
import { getClients, deleteClient } from '../../db/clientsDb'
import { sectionTitleStyle } from '../settings/_components'
import ClientCard from './ClientCard'
import ClientFormModal from './ClientFormModal'

export default function ClientsPage() {
  const [clients,       setClients]       = useState<Client[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getClients()
    setClients(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_person ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  )

  async function handleDelete(id: number) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await deleteClient(id)
    load()
  }

  function handleEdit(client: Client) {
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

      <div className="page-header" style={{ background: 'var(--color-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Clients</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {clients.length} client{clients.length !== 1 ? 's' : ''}
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
          placeholder="Search by name, contact, or phone…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>👤</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No clients matching "${search}"` : 'No clients yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to add your first client.</p>}
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
                  onDelete={handleDelete}
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
