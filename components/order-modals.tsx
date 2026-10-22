'use client'

import { useState } from 'react'
import { Ban, Loader2, Pencil, TriangleAlert, X } from 'lucide-react'
import type { EventSettings } from '@/lib/types'
import type { PurchaseGroup } from '@/lib/purchases'

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#0b0611]/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-[#fffdf9] shadow-2xl sm:max-w-lg sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({
  title,
  subtitle,
  icon,
  tone,
  onClose,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  tone: 'purple' | 'red'
  onClose: () => void
}) {
  const background =
    tone === 'red'
      ? 'from-[#721616] via-[#5c1111] to-[#3f0b0b]'
      : 'from-[#3b1d52] via-[#2a1638] to-[#1b1027]'

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${background} px-6 pb-5 pt-5 text-white`}>
      <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-[#f0a23a]/20 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-white/10">{icon}</div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 className="relative mt-4 text-xl font-bold">{title}</h2>
      <p className="relative mt-1 text-sm text-white/75">{subtitle}</p>
    </div>
  )
}

export function EditOrderModal({
  group,
  settings,
  onClose,
  onSaved,
}: {
  group: PurchaseGroup
  settings: EventSettings
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(group.name)
  const [phone, setPhone] = useState(group.phone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!group.orderId) return

    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(group.orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la compra')
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la compra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        title="Editar comprador"
        subtitle="Corrige el nombre o el teléfono sin tocar los QR."
        icon={<Pencil className="size-5 text-[#ffd08a]" />}
        tone="purple"
        onClose={onClose}
      />

      <form onSubmit={save} className="p-5 sm:p-6">
        <div className="rounded-2xl border border-[#eee3d5] bg-[#faf6ef] p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-[#5f2d83]">{group.orderId}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#756c78]">
              {group.tickets.length} {group.tickets.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>
          <p className="mt-2 text-[#756c78]">
            Total: {settings.currency} {group.total.toFixed(2)} ·{' '}
            {group.paid ? 'Pagada' : 'Pendiente de pago'}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {group.tickets.map((ticket) => (
              <span
                key={ticket.id}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[#5f2d83]"
              >
                {ticket.id}
              </span>
            ))}
          </p>
        </div>

        <label className="mt-4 block text-sm font-semibold">
          Nombre completo
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none transition focus:border-[#5f2d83] focus:ring-4 focus:ring-[#5f2d83]/10"
            autoFocus
          />
        </label>

        <label className="mt-3 block text-sm font-semibold">
          Teléfono <span className="font-normal text-[#8a808c]">(opcional)</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={40}
            inputMode="tel"
            placeholder="Ej. 987 654 321"
            className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none transition focus:border-[#5f2d83] focus:ring-4 focus:ring-[#5f2d83]/10"
          />
        </label>

        <div className="mt-4 rounded-xl bg-[#f0e9f4] px-4 py-3 text-xs text-[#5f2d83]">
          El precio, la cantidad y los códigos QR no se pueden modificar. Si algo más está mal,
          cancela la compra y emite una nueva.
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-semibold text-[#9b2c2c]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white transition hover:bg-[#4c2370] disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-[#ded7d1] bg-white px-4 py-3 font-bold text-[#241f2b] transition hover:bg-[#faf6ef] disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function CancelOrderModal({
  group,
  onClose,
  onCancelled,
}: {
  group: PurchaseGroup
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState('')
  const [accepted, setAccepted] = useState(group.usedCount === 0)
  const [serverUsed, setServerUsed] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasUsed = group.usedCount > 0 || (serverUsed ?? 0) > 0
  const usedCount = Math.max(group.usedCount, serverUsed ?? 0)

  async function cancel() {
    if (!group.orderId || (hasUsed && !accepted)) return

    setCancelling(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(group.orderId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || null, force: hasUsed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Si otra persona usó una entrada después de abrir el modal, el
        // servidor exige una segunda confirmación que aún no habíamos pedido.
        if (data.reason === 'has_used_tickets' && Number.isFinite(Number(data.used))) {
          setServerUsed(Number(data.used))
          setAccepted(false)
        }
        throw new Error(data.error || 'No se pudo cancelar la compra')
      }
      onCancelled()
    } catch (e: any) {
      setError(e?.message || 'No se pudo cancelar la compra')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        title="Cancelar compra"
        subtitle="Los QR de esta compra dejarán de funcionar de inmediato."
        icon={<Ban className="size-5 text-[#ffc9c9]" />}
        tone="red"
        onClose={onClose}
      />

      <div className="p-5 sm:p-6">
        <div className="rounded-2xl border border-[#f0cfcf] bg-[#fdf3f3] p-4">
          <p className="text-sm text-[#7a4141]">
            Se cancelarán{' '}
            <b>
              {group.tickets.length} {group.tickets.length === 1 ? 'entrada' : 'entradas'}
            </b>{' '}
            de <b>{group.name}</b> ({group.orderId}).
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.tickets.map((ticket) => (
              <span
                key={ticket.id}
                className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                  ticket.used ? 'bg-[#fff1cc] text-[#8a5a06]' : 'bg-white text-[#5f2d83]'
                }`}
              >
                {ticket.id}
                {ticket.used ? ' · usada' : ''}
              </span>
            ))}
          </div>
        </div>

        {hasUsed && (
          <div className="mt-3 rounded-2xl border border-[#f0d49b] bg-[#fff8e6] p-4 text-sm text-[#7a5300]">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {usedCount} de {group.tickets.length} entradas ya fueron utilizadas.
            </p>
            <p className="mt-1 text-xs">
              Si cancelas, también quedarán invalidadas y no podrán volver a usarse.
            </p>
            <label className="mt-3 flex items-start gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 size-4 accent-[#9b2c2c]"
              />
              Entiendo y deseo cancelar la compra de todos modos.
            </label>
          </div>
        )}

        <label className="mt-4 block text-sm font-semibold">
          Motivo <span className="font-normal text-[#8a808c]">(opcional)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ej. Se registró el monto equivocado"
            className="mt-2 w-full resize-none rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none transition focus:border-[#9b2c2c] focus:ring-4 focus:ring-[#9b2c2c]/10"
          />
        </label>

        <div className="mt-3 rounded-xl bg-[#faf6ef] px-4 py-3 text-xs text-[#756c78]">
          Esta acción es definitiva. Después podrás vender entradas nuevas con otros datos y otros
          QR.
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-semibold text-[#9b2c2c]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            onClick={cancel}
            disabled={cancelling || (hasUsed && !accepted)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#9b2c2c] px-4 py-3 font-bold text-white transition hover:bg-[#7f2323] disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            {cancelling ? 'Cancelando...' : 'Sí, cancelar compra'}
          </button>
          <button
            onClick={onClose}
            disabled={cancelling}
            className="flex-1 rounded-xl border border-[#ded7d1] bg-white px-4 py-3 font-bold text-[#241f2b] transition hover:bg-[#faf6ef] disabled:opacity-60"
          >
            Volver
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
