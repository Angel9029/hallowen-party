'use client'

import { useMemo, useState } from 'react'
import { Check, Download, Plus, QrCode, Ticket, X } from 'lucide-react'
import type { Attendee, EventSettings, Order } from '@/lib/types'
import { downloadTicketsPdf, shareTicketsPdf } from '@/lib/ticket-pdf'

type Props = {
  settings: EventSettings
  onClose: () => void
  onSaved: (tickets: Attendee[]) => void
}

type PurchaseResult = {
  order: Order
  tickets: Attendee[]
}

export function PurchaseModal({ settings, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(settings.price.toFixed(2))
  const [paid, setPaid] = useState('si')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PurchaseResult | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMessage, setPdfMessage] = useState<string | null>(null)

  const total = useMemo(() => {
    const price = Number(unitPrice)
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return 0
    return Math.max(0, price * quantity)
  }, [unitPrice, quantity])

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  function updateQuantity(next: number) {
    setQuantity(Math.min(50, Math.max(1, Math.floor(next) || 1)))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Escribe el nombre de la persona que compra.')
      return
    }

    const price = Number(unitPrice)
    if (!Number.isFinite(price) || price < 0) {
      setError('El precio por entrada debe ser mayor o igual a 0.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          quantity,
          unit_price: price,
          paid: paid === 'si',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la compra')

      setResult({ order: data.order, tickets: data.tickets })
      onSaved(data.tickets)
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la compra')
    } finally {
      setSubmitting(false)
    }
  }

  async function download() {
    if (!result) return
    setPdfBusy(true)
    setPdfMessage(null)
    try {
      await downloadTicketsPdf(result.tickets, settings, result.order)
      setPdfMessage('PDF generado con todas las entradas.')
    } catch (e: any) {
      setPdfMessage(e?.message || 'No se pudo generar el PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function share() {
    if (!result) return
    setPdfBusy(true)
    setPdfMessage(null)
    try {
      const shared = await shareTicketsPdf(result.tickets, settings, result.order)
      if (!shared) setPdfMessage('Este navegador no permite compartir archivos. Descarga el PDF.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') setPdfMessage(e?.message || 'No se pudo compartir el PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#241f2b]/40 p-4 sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {result ? 'Entradas generadas' : 'Vender entradas'}
            </h2>
            <p className="mt-1 text-sm text-[#8a808c]">
              {result
                ? 'Cada entrada tiene su propio QR y su propia validez.'
                : 'Una persona puede comprar una o varias entradas.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>

        {!result && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="text-sm font-semibold">
              Nombre completo
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Ana López"
                className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none focus:border-[#5f2d83]"
              />
            </label>

            <label className="text-sm font-semibold">
              Teléfono <span className="font-normal text-[#8a808c]">(opcional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 987 654 321"
                inputMode="tel"
                className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none focus:border-[#5f2d83]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Cantidad de entradas
                <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[#ded7d1]">
                  <button
                    type="button"
                    onClick={() => updateQuantity(quantity - 1)}
                    className="px-4 text-lg font-bold text-[#5f2d83] disabled:opacity-40"
                    disabled={quantity <= 1}
                    aria-label="Quitar una entrada"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => updateQuantity(Number(e.target.value))}
                    className="w-full min-w-0 border-x border-[#ded7d1] py-3 text-center font-normal outline-none focus:border-[#5f2d83]"
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(quantity + 1)}
                    className="px-4 text-lg font-bold text-[#5f2d83] disabled:opacity-40"
                    disabled={quantity >= 50}
                    aria-label="Agregar una entrada"
                  >
                    +
                  </button>
                </div>
              </label>

              <label className="text-sm font-semibold">
                Precio por entrada
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none focus:border-[#5f2d83]"
                />
              </label>
            </div>

            <label className="text-sm font-semibold">
              ¿Pagó?
              <select
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#ded7d1] bg-white px-4 py-3 font-normal outline-none focus:border-[#5f2d83]"
              >
                <option value="si">Sí, pagado</option>
                <option value="no">No, pendiente</option>
              </select>
            </label>

            <div className="flex items-center justify-between rounded-2xl bg-[#f7f5f2] px-5 py-4">
              <span className="text-sm font-semibold text-[#756c78]">
                Total ({quantity} {quantity === 1 ? 'entrada' : 'entradas'})
              </span>
              <span className="text-2xl font-bold text-[#5f2d83]">
                {settings.currency} {total.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-[#8a808c]">
              El precio ingresado se guarda solo para esta venta. Puedes cambiarlo en cualquier
              momento desde el panel del evento.
            </p>

            {error && (
              <p className="rounded-xl bg-[#fff0df] px-4 py-3 text-sm font-semibold text-[#a35c27]">
                {error}
              </p>
            )}

            <button
              className="flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              <Plus />
              {submitting
                ? 'Generando entradas...'
                : `Generar ${quantity} ${quantity === 1 ? 'entrada' : 'entradas'}`}
            </button>
          </form>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-[#f0e9f4] p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#5f2d83] text-white">
                  <Check />
                </div>
                <div>
                  <p className="font-bold">
                    {result.order.quantity}{' '}
                    {result.order.quantity === 1 ? 'entrada generada' : 'entradas generadas'}
                  </p>
                  <p className="mt-1 text-sm text-[#756c78]">
                    Compra {result.order.id} · Total {settings.currency}{' '}
                    {Number(result.order.total).toFixed(2)}
                  </p>
                  <p className="text-sm text-[#756c78]">
                    {result.order.paid ? 'Pagada' : 'Pendiente de pago'}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-48 overflow-auto rounded-2xl border border-[#e7e0da]">
              {result.tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between gap-3 border-b border-[#eee8e3] px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="size-4 text-[#5f2d83]" />
                    <div>
                      <p className="text-sm font-bold text-[#5f2d83]">{ticket.id}</p>
                      <p className="text-xs text-[#8a808c]">{ticket.name}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      ticket.paid ? 'bg-[#e5f5eb] text-[#2e8a54]' : 'bg-[#fff8d8] text-[#a68300]'
                    }`}
                  >
                    {ticket.paid ? 'Válida' : 'Pendiente de pago'}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-sm text-[#756c78]">
              Descarga un solo PDF con un QR por página. Cada entrada se inhabilita de forma
              individual al escanearse por primera vez.
            </p>

            <button
              onClick={download}
              disabled={pdfBusy}
              className="flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              <Download />
              {pdfBusy ? 'Preparando PDF...' : 'Descargar PDF con todas las entradas'}
            </button>

            {canShare && (
              <button
                onClick={share}
                disabled={pdfBusy}
                className="flex w-full justify-center gap-2 rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"
              >
                <Ticket /> Compartir PDF
              </button>
            )}

            {pdfMessage && (
              <p className="rounded-xl bg-[#e5f5eb] px-4 py-3 text-sm font-semibold text-[#2e8a54]">
                {pdfMessage}
              </p>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
