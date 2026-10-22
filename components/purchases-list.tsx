'use client'

import { useMemo, useState } from 'react'
import {
  Ban,
  CalendarDays,
  FileDown,
  Ghost,
  Loader2,
  Pencil,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  Users,
} from 'lucide-react'
import type { Attendee, EventSettings } from '@/lib/types'
import {
  formatDateTime,
  groupMatchesQuery,
  groupPurchases,
  type PurchaseGroup,
} from '@/lib/purchases'

type Props = {
  attendees: Attendee[]
  settings: EventSettings
  query: string
  setQuery: (value: string) => void
  onPurchase: () => void
  onQr: (attendee: Attendee) => void
  onEdit: (group: PurchaseGroup) => void
  onCancel: (group: PurchaseGroup) => void
  onDownload: (group: PurchaseGroup) => void
  downloadingKey: string | null
}

export function PurchasesList({
  attendees,
  settings,
  query,
  setQuery,
  onPurchase,
  onQr,
  onEdit,
  onCancel,
  onDownload,
  downloadingKey,
}: Props) {
  const [showCancelled, setShowCancelled] = useState(false)

  const groups = useMemo(() => groupPurchases(attendees, settings), [attendees, settings])
  const cancelledGroups = groups.filter((group) => group.cancelledAt)
  const visible = groups.filter(
    (group) => (showCancelled || !group.cancelledAt) && groupMatchesQuery(group, query)
  )
  const activeTickets = groups
    .filter((group) => !group.cancelledAt)
    .reduce((sum, group) => sum + group.tickets.length, 0)

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#f0e9f4] px-3 py-1 text-xs font-bold text-[#5f2d83]">
            <Users className="size-3.5" /> {activeTickets} entradas activas
          </p>
          <h2 className="text-3xl font-bold tracking-tight">Asistentes y compras</h2>
          <p className="mt-2 text-[#756c78]">
            Cada compra agrupa sus entradas. Edita el comprador, descarga el PDF o cancela toda la
            compra.
          </p>
        </div>
        <button
          onClick={onPurchase}
          className="flex justify-center gap-2 rounded-xl bg-[#f0a23a] px-4 py-3 text-sm font-bold text-[#2a1638] transition hover:bg-[#ffb35c]"
        >
          <Plus className="size-4" /> Vender entradas
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#e7dccd] bg-white shadow-sm">
        <div className="border-b border-[#eee3d5] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-[#faf6ef] px-4 py-3">
              <Search className="size-4 text-[#8a808c]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, teléfono, código u orden..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              onClick={() => setShowCancelled((value) => !value)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                showCancelled
                  ? 'border-[#9b2c2c] bg-[#fdf3f3] text-[#9b2c2c]'
                  : 'border-[#ded7d1] bg-white text-[#756c78] hover:bg-[#faf6ef]'
              }`}
            >
              <Ban className="size-3.5" />
              {showCancelled ? 'Ocultar canceladas' : `Ver canceladas (${cancelledGroups.length})`}
            </button>
          </div>
        </div>

        {visible.length === 0 && (
          <div className="px-5 py-14 text-center">
            <Ghost className="mx-auto size-10 text-[#5f2d83]/30" />
            <p className="mt-3 font-semibold">
              {attendees.length === 0 ? 'Todavía no hay entradas registradas' : 'Sin resultados'}
            </p>
            <p className="mt-1 text-sm text-[#8a808c]">
              {attendees.length === 0
                ? 'Vende la primera entrada y aparecerá aquí agrupada por compra.'
                : 'Prueba con otro nombre, teléfono, código u orden.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-[#eee3d5]">
          {visible.map((group) => {
            const cancelled = Boolean(group.cancelledAt)
            const busyPdf = downloadingKey === group.key
            const statusLabel = cancelled
              ? 'Cancelada'
              : group.paid
                ? 'Pagada'
                : 'Pendiente'
            const statusClass = cancelled
              ? 'bg-[#fdecec] text-[#9b2c2c]'
              : group.paid
                ? 'bg-[#e5f5eb] text-[#2e8a54]'
                : 'bg-[#fff8d8] text-[#a68300]'

            return (
              <article key={group.key} className={cancelled ? 'bg-[#fdfafa]' : 'bg-white'}>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                        cancelled ? 'bg-[#f7e4e4] text-[#9b2c2c]' : 'bg-[#f0e9f4] text-[#5f2d83]'
                      }`}
                    >
                      {cancelled ? <Ban className="size-5" /> : <Ghost className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`break-words text-lg font-bold ${cancelled ? 'text-[#7a5a5a]' : ''}`}>
                          {group.name}
                        </h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {group.usedCount > 0 && (
                          <span className="rounded-full bg-[#fff1cc] px-2.5 py-1 text-[11px] font-bold text-[#8a5a06]">
                            {group.usedCount}/{group.tickets.length} ingresaron
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a808c]">
                        {group.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {group.phone}
                          </span>
                        )}
                        {group.orderId && (
                          <span className="flex items-center gap-1">
                            <ReceiptText className="size-3" /> {group.orderId}
                          </span>
                        )}
                        {group.createdAt && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" /> {formatDateTime(group.createdAt)}
                          </span>
                        )}
                      </div>
                      {cancelled && (
                        <p className="mt-2 rounded-lg bg-[#fdecec] px-3 py-2 text-xs text-[#9b2c2c]">
                          <b>Cancelada:</b> {formatDateTime(group.cancelledAt)}
                          {group.cancelReason ? ` · ${group.cancelReason}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <p className={`text-xl font-bold ${cancelled ? 'text-[#a88b8b] line-through' : 'text-[#241f2b]'}`}>
                      {settings.currency} {group.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#8a808c]">
                      {group.tickets.length}{' '}
                      {group.tickets.length === 1 ? 'entrada' : 'entradas'} ·{' '}
                      {settings.currency} {group.unitPrice.toFixed(2)} c/u
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.orderId && !cancelled && (
                        <button
                          onClick={() => onEdit(group)}
                          className="flex items-center gap-1.5 rounded-lg border border-[#ded7d1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#5f2d83] transition hover:bg-[#f0e9f4]"
                        >
                          <Pencil className="size-3.5" /> Editar
                        </button>
                      )}
                      <button
                        onClick={() => onDownload(group)}
                        disabled={busyPdf}
                        className="flex items-center gap-1.5 rounded-lg border border-[#ded7d1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#241f2b] transition hover:bg-[#faf6ef] disabled:opacity-60"
                      >
                        {busyPdf ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <FileDown className="size-3.5" />
                        )}
                        {busyPdf ? 'Generando...' : 'PDF'}
                      </button>
                      {group.orderId && !cancelled && (
                        <button
                          onClick={() => onCancel(group)}
                          className="flex items-center gap-1.5 rounded-lg border border-[#f0cfcf] bg-[#fdf3f3] px-2.5 py-1.5 text-xs font-bold text-[#9b2c2c] transition hover:bg-[#fbe5e5]"
                        >
                          <Ban className="size-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-[#f1e9df] bg-[#fcfaf6] p-4 sm:grid-cols-2">
                  {group.tickets.map((ticket) => {
                    const ticketStatus = cancelled
                      ? 'Cancelada'
                      : ticket.used
                        ? 'Utilizada'
                        : ticket.paid
                          ? 'Disponible'
                          : 'Pendiente'
                    const ticketClass = cancelled
                      ? 'bg-[#fdecec] text-[#9b2c2c]'
                      : ticket.used
                        ? 'bg-[#f0e9f4] text-[#5f2d83]'
                        : ticket.paid
                          ? 'bg-[#e5f5eb] text-[#2e8a54]'
                          : 'bg-[#fff8d8] text-[#a68300]'

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => onQr(ticket)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#eee3d5] bg-white px-3 py-2.5 text-left transition hover:border-[#5f2d83]/40 hover:shadow-sm"
                        title="Ver QR"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <QrCode className="size-4 shrink-0 text-[#5f2d83]" />
                          <span className="truncate text-sm font-bold text-[#5f2d83]">{ticket.id}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-[#8a808c]">
                            {settings.currency} {Number(ticket.unit_price ?? settings.price).toFixed(2)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ticketClass}`}>
                            {ticketStatus}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
