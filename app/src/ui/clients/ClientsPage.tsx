import React, { useEffect, useState, useCallback } from 'react'
import type { ClientWithGstins } from '../../db/types'
import { getClients, deactivateClient } from '../../db/clientsDb'
import ClientCard from './ClientCard'
import ClientFormModal from './ClientFormModal'

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
    if (!confirm('Remove this client? This cannot be undone.')) return
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

  function handleModalClose() {
    setModalOpen(false)
    setEditingClient(null)
  }

  function handleSaved() {
    handleModalClose()
    load()
  }

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Header */}
      <div className="bg-[#3B2A1F] px-5 pt-12 pb-5 safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#F5F1E8] font-[Playfair_Display]">Clients</h1>
            <p className="text-xs text-[#C8A96A] mt-0.5">{clients.length} active client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={handleAdd}
            className="w-11 h-11 rounded-full bg-[#C8A96A] text-[#3B2A1F] text-2xl font-bold flex items-center justify-center hover:bg-[#A07840] transition-colors shadow-lg"
          >+</button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or GSTIN…"
            className="w-full rounded-xl bg-white/10 text-[#F5F1E8] placeholder-[#C8A96A]/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[#7A6A58] text-sm">Loading clients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-[#C8A96A]/20 flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <p className="text-[#7A6A58] text-sm text-center">
              {search ? `No clients matching "${search}"` : 'No clients yet. Tap + to add one.'}
            </p>
          </div>
        ) : (
          filtered.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ClientFormModal
          client={editingClient}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
