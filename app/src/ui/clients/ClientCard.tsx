import React from 'react'
import type { ClientWithGstins } from '../../db/types'

interface Props {
  client: ClientWithGstins
  onEdit: (client: ClientWithGstins) => void
  onDeactivate: (id: number) => void
}

export default function ClientCard({ client, onEdit, onDeactivate }: Props) {
  const primaryGstin = client.gstins.find(g => g.is_primary) ?? client.gstins[0]

  return (
    <div className="bg-white rounded-2xl border border-[#C8A96A]/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {/* Avatar initial */}
        <div className="w-10 h-10 rounded-full bg-[#C8A96A]/20 flex items-center justify-center shrink-0">
          <span className="text-[#A07840] font-semibold text-sm">
            {client.name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#3B2A1F] text-sm truncate">{client.name}</p>
          <p className="text-xs text-[#7A6A58] mt-0.5 truncate">{client.address}</p>
          {primaryGstin && (
            <p className="text-xs font-mono text-[#5A4A38] mt-1">{primaryGstin.gstin}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="text-xs bg-[#F5F1E8] text-[#7A6A58] px-2 py-0.5 rounded-full border border-[#C8A96A]/20">
              {client.state}
            </span>
            {client.gstins.length > 1 && (
              <span className="text-xs bg-[#C8A96A]/15 text-[#A05C1A] px-2 py-0.5 rounded-full">
                +{client.gstins.length - 1} more GSTIN{client.gstins.length > 2 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => onEdit(client)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#C8A96A]/15 text-[#A07840] text-xs font-medium hover:bg-[#C8A96A]/30 transition-colors"
          >Edit</button>
          <button
            onClick={() => onDeactivate(client.id)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#8B2E2E]/10 text-[#8B2E2E] text-xs font-medium hover:bg-[#8B2E2E]/20 transition-colors"
          >Remove</button>
        </div>
      </div>
    </div>
  )
}
