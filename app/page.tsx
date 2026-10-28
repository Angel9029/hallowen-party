'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  BadgeCheck,
  Ban,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Ghost,
  Home,
  Menu,
  Moon,
  PartyPopper,
  Plus,
  QrCode,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import type { Attendee, EventSettings, Result, View } from '@/lib/types'
import { PurchaseModal } from '@/components/purchase-modal'
import { Scanner } from '@/components/scanner'
import { PurchasesList } from '@/components/purchases-list'
import { CancelOrderModal, EditOrderModal } from '@/components/order-modals'
import { downloadTicketsPdf, shareTicketsPdf } from '@/lib/ticket-pdf'
import { groupToOrder, type PurchaseGroup } from '@/lib/purchases'

const FALLBACK_SETTINGS: EventSettings = {
  id: 'default',
  event_name: 'Halloween Party',
  event_date: '2026-10-31',
  price: 5,
  currency: 'S/',
}

function formatEventDate(value: string, options: Intl.DateTimeFormatOptions) {
  try {
    const date = new Date(`${value}T12:00:00`)
    const formatted = new Intl.DateTimeFormat('es-PE', options).format(date)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return value
  }
}

type Notice = { tone: 'success' | 'error'; message: string }

export default function Page() {
  const [view, setView] = useState<View>('inicio')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [settings, setSettings] = useState<EventSettings>(FALLBACK_SETTINGS)
  const [query, setQuery] = useState('')
  const [showPurchase, setShowPurchase] = useState(false)
  const [selected, setSelected] = useState<Attendee | null>(null)
  const [editingGroup, setEditingGroup] = useState<PurchaseGroup | null>(null)
  const [cancellingGroup, setCancellingGroup] = useState<PurchaseGroup | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [payingKey, setPayingKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [scanResult, setScanResult] = useState<Result>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [matchedAttendee, setMatchedAttendee] = useState<Attendee | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)

  const fetchAttendees = async () => {
    try {
      const res = await fetch('/api/attendees', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setSetupError(data.error || `El servidor respondió con estado ${res.status}.`)
        return
      }
      setSetupError(null)
      setAttendees(data.attendees || [])
    } catch {
      setSetupError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
    } catch {
      // Mantiene el precio de respaldo hasta que haya conexión.
    }
  }

  useEffect(() => {
    fetchAttendees()
    fetchSettings()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const stats = useMemo(() => {
    const active = attendees.filter((person) => !person.cancelled_at)
    const total = active.length
    const paid = active.filter((person) => person.paid).length
    const pending = total - paid
    const used = active.filter((person) => person.used).length
    const collected = active
      .filter((person) => person.paid)
      .reduce((sum, person) => sum + Number(person.unit_price ?? settings.price), 0)
    const pendingAmount = active
      .filter((person) => !person.paid)
      .reduce((sum, person) => sum + Number(person.unit_price ?? settings.price), 0)
    const cancelled = attendees.length - active.length

    return { total, paid, pending, used, collected, pendingAmount, cancelled }
  }, [attendees, settings.price])

  const eventDateShort = useMemo(
    () => formatEventDate(settings.event_date, { day: 'numeric', month: 'long', year: 'numeric' }),
    [settings.event_date]
  )
  const eventDateLong = useMemo(
    () =>
      formatEventDate(settings.event_date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [settings.event_date]
  )

  const orderProgress = useMemo(() => {
    if (!matchedAttendee?.order_id) return null
    const tickets = attendees.filter((person) => person.order_id === matchedAttendee.order_id)
    if (!tickets.length) return null
    return {
      used: tickets.filter((ticket) => ticket.used).length,
      total: tickets.length,
    }
  }, [attendees, matchedAttendee])

  async function savePrice(price: number) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudo guardar el precio')
    if (data.settings) setSettings(data.settings)
  }

  async function validateCode(code = scanCode) {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setScanCode(trimmed)
    setScanMessage(null)

    try {
      const res = await fetch('/api/attendees/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()

      if (data.valid && data.attendee) {
        setScanResult('valid')
        setMatchedAttendee(data.attendee)
        return
      }

      setMatchedAttendee(data.attendee || null)

      if (data.reason === 'cancelled') {
        setScanResult('cancelled')
        setScanMessage('La compra de esta entrada fue cancelada. No es válida para ingresar.')
        return
      }

      if (data.reason === 'already_used') {
        setScanResult('used')
        setScanMessage('Esta entrada ya fue utilizada y no puede volver a ingresar.')
        return
      }

      if (data.reason === 'not_paid') {
        setScanResult('invalid')
        setScanMessage('La entrada existe pero está pendiente de pago.')
        return
      }

      if (data.reason === 'not_found') {
        setScanResult('invalid')
        setScanMessage('No existe una entrada con ese código.')
        return
      }

      setScanResult('invalid')
      setScanMessage(data.error || 'No se pudo validar la entrada.')
    } catch {
      setScanResult('invalid')
      setMatchedAttendee(null)
      setScanMessage('No se pudo conectar con el servidor.')
    }
  }

  async function confirmEntry() {
    const id = (matchedAttendee?.id || scanCode).trim().toUpperCase()
    if (!id) return
    setConfirming(true)
    try {
      const res = await fetch('/api/attendees/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: id }),
      })
      const data = await res.json()

      if (data.success && data.attendee) {
        setAttendees((current) => current.map((person) => (person.id === id ? data.attendee : person)))
        setMatchedAttendee(data.attendee)
        setScanResult('checked')
        setScanMessage('Ingreso registrado. Esta entrada quedó inhabilitada.')
        return
      }

      if (data.attendee) {
        setAttendees((current) => current.map((person) => (person.id === id ? data.attendee : person)))
        setMatchedAttendee(data.attendee)
      }

      setScanResult(
        data.reason === 'already_used'
          ? 'used'
          : data.reason === 'cancelled'
            ? 'cancelled'
            : 'invalid'
      )
      setScanMessage(data.error || 'No se pudo registrar el ingreso.')
    } catch {
      setScanMessage('No se pudo conectar con el servidor.')
    } finally {
      setConfirming(false)
    }
  }

  async function downloadPurchase(group: PurchaseGroup) {
    setDownloadingKey(group.key)
    try {
      await downloadTicketsPdf(group.tickets, settings, groupToOrder(group))
      setNotice({
        tone: 'success',
        message: group.cancelledAt
          ? 'PDF generado con la marca de agua CANCELADA.'
          : 'PDF generado con todos los QR de la compra.',
      })
    } catch (error: any) {
      setNotice({ tone: 'error', message: error?.message || 'No se pudo generar el PDF.' })
    } finally {
      setDownloadingKey(null)
    }
  }

  async function handleEditSaved() {
    setEditingGroup(null)
    setNotice({ tone: 'success', message: 'Datos del comprador actualizados. Los QR no cambiaron.' })
    await fetchAttendees()
  }

  async function handleCancelled() {
    setCancellingGroup(null)
    setSelected(null)
    setNotice({
      tone: 'success',
      message: 'Compra cancelada. Sus QR quedaron inválidos y el PDF llevará la marca CANCELADA.',
    })
    await fetchAttendees()
  }

  async function handlePayGroup(group: PurchaseGroup, action: 'mark_paid_pending' | 'mark_paid_all') {
    if (!group.orderId) return
    setPayingKey(group.key)
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(group.orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el pago')
      await fetchAttendees()
      setNotice({
        tone: 'success',
        message:
          action === 'mark_paid_pending'
            ? 'Entradas pendientes marcadas como pagadas.'
            : 'Toda la compra fue marcada como pagada.',
      })
    } catch (e: any) {
      setNotice({ tone: 'error', message: e?.message || 'No se pudo actualizar el pago' })
    } finally {
      setPayingKey(null)
    }
  }

  async function handlePayTicket(ticket: Attendee, group: PurchaseGroup) {
    if (!group.orderId) return
    setPayingKey(ticket.id)
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(group.orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_ticket_paid', ticketId: ticket.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo marcar como pagada')
      await fetchAttendees()
      setNotice({ tone: 'success', message: `${ticket.id} marcado como pagado.` })
    } catch (e: any) {
      setNotice({ tone: 'error', message: e?.message || 'No se pudo marcar como pagada' })
    } finally {
      setPayingKey(null)
    }
  }

  function handleNavClick(nextView: View) {
    setView(nextView)
    setMobileMenuOpen(false)
  }

  function openPurchase() {
    setShowPurchase(true)
    setMobileMenuOpen(false)
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#241f2b]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[256px] shrink-0 flex-col border-r border-[#30203f] bg-[#1b1226] px-5 py-6 text-[#f6efe7] lg:flex">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ffb35c] to-[#e8751a] text-[#2a1638] shadow-lg shadow-[#f0a23a]/20">
              <Ghost className="size-6" />
            </div>
            <div>
              <p className="font-bold text-white">{settings.event_name}</p>
              <p className="text-xs text-[#bda9ca]">Panel de entradas</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2" aria-label="Navegación">
            <NavItem icon={<Home />} label="Inicio" active={view === 'inicio'} onClick={() => setView('inicio')} />
            <NavItem icon={<Users />} label="Asistentes" active={view === 'asistentes'} onClick={() => setView('asistentes')} />
            <NavItem icon={<QrCode />} label="Leer entrada" active={view === 'escanear'} onClick={() => setView('escanear')} />
          </nav>
          <EventCard settings={settings} eventDate={eventDateShort} onSavePrice={savePrice} />
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div
              className="absolute inset-0 bg-[#0b0611]/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative flex h-full w-[286px] flex-col border-r border-[#30203f] bg-[#1b1226] px-5 py-6 text-[#f6efe7] shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3 px-2">
                  <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ffb35c] to-[#e8751a] text-[#2a1638]">
                    <Ghost className="size-6" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{settings.event_name}</p>
                    <p className="text-xs text-[#bda9ca]">Panel de entradas</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                  className="rounded-lg p-2 text-[#d9c9e2] hover:bg-white/10"
                >
                  <X />
                </button>
              </div>
              <nav className="flex flex-col gap-2" aria-label="Navegación móvil">
                <NavItem icon={<Home />} label="Inicio" active={view === 'inicio'} onClick={() => handleNavClick('inicio')} />
                <NavItem icon={<Users />} label="Asistentes" active={view === 'asistentes'} onClick={() => handleNavClick('asistentes')} />
                <NavItem icon={<QrCode />} label="Leer entrada" active={view === 'escanear'} onClick={() => handleNavClick('escanear')} />
              </nav>
              <EventCard settings={settings} eventDate={eventDateShort} onSavePrice={savePrice} />
            </aside>
          </div>
        )}

        <section className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#e7dccd] bg-[#fdfaf5] px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-2 text-[#5f2d83] hover:bg-[#f0e9f4] lg:hidden"
                aria-label="Abrir menú"
              >
                <Menu />
              </button>
              <div className="hidden lg:block">
                <p className="text-sm text-[#8a808c]">{eventDateLong}</p>
                <h1 className="text-xl font-bold">
                  {view === 'inicio' ? 'Resumen del evento' : view === 'asistentes' ? 'Asistentes' : 'Control de acceso'}
                </h1>
              </div>
              <p className="font-bold lg:hidden">{settings.event_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 rounded-full bg-[#f0e9f4] px-3 py-1.5 text-xs font-bold text-[#5f2d83] sm:flex">
                <Moon className="size-3.5" /> 31 de octubre
              </span>
              <div className="grid size-9 place-items-center rounded-full bg-[#f0a23a] text-sm font-bold text-[#2a1638]">
                AD
              </div>
            </div>
          </header>

          <div className="p-5 sm:p-8">
            {setupError && (
              <div className="mx-auto mb-6 max-w-[1120px] rounded-2xl border border-[#e6b8a2] bg-[#fff3ea] p-4 text-sm">
                <p className="font-bold text-[#8a3f12]">No se pudo cargar la base de datos</p>
                <p className="mt-1 break-words text-[#7a5a45]">{setupError}</p>
                <p className="mt-2 text-[#7a5a45]">
                  Abre{' '}
                  <a className="font-semibold underline" href="/api/health" target="_blank" rel="noreferrer">
                    /api/health
                  </a>{' '}
                  para ver a qué proyecto de Supabase está conectado Vercel y qué tablas faltan.
                </p>
              </div>
            )}

            {loading && view === 'inicio' && (
              <div className="mx-auto max-w-[1120px] text-[#756c78]">Cargando...</div>
            )}

            {view === 'inicio' && !loading && (
              <Dashboard
                stats={stats}
                settings={settings}
                eventDate={eventDateShort}
                onScan={() => setView('escanear')}
                onPurchase={openPurchase}
              />
            )}

            {view === 'asistentes' && (
              <PurchasesList
                attendees={attendees}
                settings={settings}
                query={query}
                setQuery={setQuery}
                onPurchase={openPurchase}
                onQr={setSelected}
                onEdit={setEditingGroup}
                onCancel={setCancellingGroup}
                onDownload={downloadPurchase}
                downloadingKey={downloadingKey}
                onPayGroup={handlePayGroup}
                onPayTicket={handlePayTicket}
                payingKey={payingKey}
              />
            )}

            {view === 'escanear' && (
              <Scanner
                settings={settings}
                scanCode={scanCode}
                setScanCode={setScanCode}
                scanResult={scanResult}
                scanMessage={scanMessage}
                matched={matchedAttendee}
                confirming={confirming}
                orderProgress={orderProgress}
                onSubmit={(event) => {
                  event.preventDefault()
                  validateCode()
                }}
                onScan={validateCode}
                onConfirm={confirmEntry}
                onClear={() => {
                  setScanResult(null)
                  setScanMessage(null)
                  setScanCode('')
                  setMatchedAttendee(null)
                }}
              />
            )}
          </div>
        </section>
      </div>

      {showPurchase && (
        <PurchaseModal
          settings={settings}
          onClose={() => setShowPurchase(false)}
          onSaved={(tickets) => setAttendees((current) => [...current, ...tickets])}
        />
      )}

      {selected && (
        <QrModal person={selected} settings={settings} onClose={() => setSelected(null)} />
      )}

      {editingGroup && (
        <EditOrderModal
          group={editingGroup}
          settings={settings}
          onClose={() => setEditingGroup(null)}
          onSaved={handleEditSaved}
        />
      )}

      {cancellingGroup && (
        <CancelOrderModal
          group={cancellingGroup}
          onClose={() => setCancellingGroup(null)}
          onCancelled={handleCancelled}
        />
      )}

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-2xl ${
              notice.tone === 'success' ? 'bg-[#1d5c3b]' : 'bg-[#8f1d1d]'
            }`}
            role="status"
          >
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15">
              {notice.tone === 'success' ? <Check className="size-3.5" /> : <Ban className="size-3.5" />}
            </span>
            <p className="flex-1">{notice.message}</p>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="rounded p-0.5 hover:bg-white/10">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition [&>svg]:size-4 ${
        active
          ? 'bg-[#3b2452] text-[#ffcf8a] shadow-inner'
          : 'text-[#c9b9d2] hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function EventCard({
  settings,
  eventDate,
  onSavePrice,
}: {
  settings: EventSettings
  eventDate: string
  onSavePrice: (price: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(settings.price.toFixed(2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setDraft(settings.price.toFixed(2))
  }, [settings.price, editing])

  async function save() {
    const price = Number(draft)
    if (!Number.isFinite(price) || price < 0) {
      setError('Ingresa un precio válido.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSavePrice(price)
      setEditing(false)
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el precio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-auto rounded-2xl border border-white/10 bg-[#2a1838] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#ffb35c]">
          <Sparkles className="size-3.5" /> Evento
        </p>
        <button
          onClick={() => setEditing((value) => !value)}
          className="text-xs font-bold text-[#ffcf8a] underline decoration-[#ffcf8a]/40 underline-offset-2"
        >
          {editing ? 'Cancelar' : 'Editar precio'}
        </button>
      </div>
      <p className="mt-1 font-semibold text-white">{eventDate}</p>

      {!editing ? (
        <>
          <p className="text-sm text-[#bda9ca]">
            {settings.currency} {settings.price.toFixed(2)} por entrada
          </p>
          <p className="mt-2 text-xs text-[#9d86ad]">El precio se actualiza sin reiniciar la app.</p>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#ffcf8a]">{settings.currency}</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-[#4a315f] bg-[#1b1226] px-2 py-1.5 text-sm text-white outline-none focus:border-[#ffb35c]"
              autoFocus
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#f0a23a] px-3 py-2 text-xs font-bold text-[#2a1638] disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar precio'}
          </button>
          <p className="text-xs text-[#9d86ad]">Se aplica a las próximas ventas.</p>
          {error && <p className="text-xs font-semibold text-[#ffb4a2]">{error}</p>}
        </div>
      )}
    </div>
  )
}

type Stats = {
  total: number
  paid: number
  pending: number
  used: number
  collected: number
  pendingAmount: number
  cancelled: number
}

function Dashboard({
  stats,
  settings,
  eventDate,
  onScan,
  onPurchase,
}: {
  stats: Stats
  settings: EventSettings
  eventDate: string
  onScan: () => void
  onPurchase: () => void
}) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2a1638] via-[#3b1d52] to-[#150a20] p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-[#f0a23a]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 size-64 rounded-full bg-[#5f2d83]/40 blur-3xl" />
        <Bat className="absolute left-[46%] top-6 size-8 text-[#ffb35c]/50" />
        <Bat className="absolute left-[54%] top-16 size-5 text-[#ffb35c]/30" />
        <Sparkles className="absolute left-[40%] top-12 size-4 text-[#ffd08a]/60" />

        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_auto] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#f0a23a] px-3 py-1 text-xs font-bold text-[#2a1638]">
              <PartyPopper className="size-3.5" /> Noche de brujas · {eventDate}
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              Todo listo para recibirlos
            </h2>
            <p className="mt-2 max-w-lg text-sm text-[#d8c8e2] sm:text-base">
              Vende una o varias entradas, entrega un PDF con todos los QR y controla el ingreso
              desde el móvil.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onPurchase}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#f0a23a] px-4 py-3 text-sm font-bold text-[#2a1638] transition hover:bg-[#ffb35c]"
              >
                <Plus className="size-4" /> Vender entradas
              </button>
              <button
                onClick={onScan}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <QrCode className="size-4" /> Leer QR
              </button>
            </div>
          </div>

          <PumpkinScene />
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Entradas"
          value={stats.total}
          note="activas"
          icon={<Users />}
          tone="purple"
        />
        <Stat
          label="Pagadas"
          value={stats.paid}
          note={`${settings.currency} ${stats.collected.toFixed(2)}`}
          icon={<BadgeCheck />}
          tone="green"
        />
        <Stat
          label="Por cobrar"
          value={stats.pending}
          note={`${settings.currency} ${stats.pendingAmount.toFixed(2)}`}
          icon={<CircleDollarSign />}
          tone="amber"
        />
        <Stat
          label="Ingresaron"
          value={stats.used}
          note={`de ${stats.paid} pagadas`}
          icon={<ClipboardCheck />}
          tone="orange"
        />
      </div>

      {stats.cancelled > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-[#8a5a5a]">
          <Ban className="size-4 text-[#9b2c2c]" />
          {stats.cancelled} {stats.cancelled === 1 ? 'entrada cancelada' : 'entradas canceladas'} no
          se cuentan en los totales. Puedes verlas en Asistentes.
        </p>
      )}

      <div className="mt-6 rounded-3xl border border-[#e7dccd] bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold">
          <Ghost className="size-4 text-[#5f2d83]" /> Cómo funciona
        </h3>
        <div className="mt-4 grid gap-3 text-sm text-[#756c78] sm:grid-cols-4">
          <Step n="1">Define el precio del evento.</Step>
          <Step n="2">Vende una o varias entradas.</Step>
          <Step n="3">Descarga el PDF con todos los QR.</Step>
          <Step n="4">Escanea: cada QR se inhabilita al ingresar.</Step>
        </div>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-[#faf6ef] px-3 py-3">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f0a23a] text-[10px] font-bold text-[#2a1638]">
        {n}
      </span>
      <span>{children}</span>
    </p>
  )
}

function Bat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M32 12c2.8 0 4.4 2.2 5.3 4.6 3.1-5.2 9-8.5 15.4-8.6-3.7 2.5-5.9 5.8-6.3 9.7 3.6-2.6 7.8-3.4 11.6-2.4-5 2-8.6 5.4-10.7 9.6-3.9-2.4-7.9-3-11.6-1.8-1.2 3.5-2.4 5.2-3.7 6.9-1.3-1.7-2.5-3.4-3.7-6.9-3.7-1.2-7.7-.6-11.6 1.8-2.1-4.2-5.7-7.6-10.7-9.6 3.8-1 8-.2 11.6 2.4-.4-3.9-2.6-7.2-6.3-9.7 6.4.1 12.3 3.4 15.4 8.6C27.6 14.2 29.2 12 32 12z" />
    </svg>
  )
}

function PumpkinScene() {
  return (
    <div className="relative mx-auto hidden h-48 w-48 shrink-0 lg:block" aria-hidden="true">
      <div className="absolute inset-4 rounded-full bg-[#f0a23a]/20 blur-3xl" />
      <svg viewBox="0 0 200 200" className="relative size-full animate-floaty">
        <circle cx="154" cy="38" r="18" fill="#f7cd6b" opacity="0.95" />
        <circle cx="162" cy="31" r="16" fill="#2a1638" />
        <circle cx="48" cy="32" r="1.6" fill="#ffd08a" />
        <circle cx="70" cy="22" r="1.1" fill="#ffd08a" opacity="0.8" />
        <circle cx="104" cy="30" r="1.3" fill="#ffd08a" opacity="0.7" />
        <path
          d="M18 52c5-7 12-7 17 0 5-7 12-7 17 0-6 1-11 4-17 10-6-6-11-9-17-10z"
          fill="#f0a23a"
          opacity="0.6"
        />
        <path
          d="M118 62c4-5 9-5 13 0 4-5 9-5 13 0-5 1-8 3-13 8-5-5-8-7-13-8z"
          fill="#f0a23a"
          opacity="0.35"
        />
        <ellipse cx="100" cy="130" rx="44" ry="37" fill="#f08a24" />
        <ellipse cx="63" cy="130" rx="29" ry="33" fill="#e57a18" />
        <ellipse cx="137" cy="130" rx="29" ry="33" fill="#e57a18" />
        <rect x="94" y="82" width="12" height="24" rx="5" fill="#5d7a34" transform="rotate(7 100 94)" />
        <path d="M88 112l12 14 12-14z" fill="#2a1638" />
        <path d="M112 118l12-2-5 14z" fill="#2a1638" />
        <path
          d="M71 143c9 3 15 8 19 14 4-6 6-6 10 0 4 6 10 3 19-14-11 7-20 9-29 9-9 0-18-2-29-9z"
          fill="#2a1638"
          opacity="0.9"
        />
        <path d="M88 154c4 3 8 4 12 4s8-1 12-4" stroke="#f7cd6b" strokeWidth="2" fill="none" />
      </svg>
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string
  value: number
  note: string
  icon: React.ReactNode
  tone: 'purple' | 'green' | 'amber' | 'orange'
}) {
  const tones = {
    purple: 'bg-[#f0e9f4] text-[#5f2d83]',
    green: 'bg-[#e5f5eb] text-[#2e8a54]',
    amber: 'bg-[#fff4d6] text-[#a68300]',
    orange: 'bg-[#fff0df] text-[#c25a12]',
  }

  return (
    <div className="rounded-2xl border border-[#e7dccd] bg-white p-5 shadow-sm">
      <div className={`mb-5 grid size-10 place-items-center rounded-xl [&>svg]:size-5 ${tones[tone]}`}>
        {icon}
      </div>
      <p className="text-sm text-[#8a808c]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-xs text-[#8a808c]">{note}</span>
      </div>
    </div>
  )
}

function QrModal({
  person,
  settings,
  onClose,
}: {
  person: Attendee
  settings: EventSettings
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (canvasRef.current && typeof window !== 'undefined') {
      QRCode.toCanvas(canvasRef.current, person.id, {
        width: Math.min(260, window.innerWidth - 80),
        margin: 2,
      })
    }
  }, [person.id])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  const cancelled = Boolean(person.cancelled_at)
  const used = Boolean(person.used)
  const status = cancelled ? 'Cancelada' : used ? 'Utilizada' : person.paid ? 'Pagada' : 'Pendiente'
  const statusClass = cancelled
    ? 'bg-[#fdecec] text-[#9b2c2c]'
    : used
      ? 'bg-[#f0e9f4] text-[#5f2d83]'
      : person.paid
        ? 'bg-[#e5f5eb] text-[#2e8a54]'
        : 'bg-[#fff8d8] text-[#a68300]'

  async function download() {
    setBusy(true)
    setMessage(null)
    try {
      await downloadTicketsPdf([person], settings)
      setMessage('PDF de la entrada generado.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo generar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    setBusy(true)
    setMessage(null)
    try {
      const shared = await shareTicketsPdf([person], settings)
      if (!shared) setMessage('Este navegador no permite compartir archivos.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMessage(e?.message || 'No se pudo compartir la entrada.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[#0b0611]/75 p-4 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-3xl bg-[#fffdf9] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-end">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-full text-[#756c78] hover:bg-[#faf6ef]"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-[#8a808c]">Entrada de</p>
        <h2 className="break-words text-xl font-bold">{person.name}</h2>
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
          {status}
        </span>
        <canvas
          ref={canvasRef}
          className="mx-auto my-5 max-w-full"
          aria-label={`Código QR de ${person.name}`}
        />
        <p className="font-bold text-[#5f2d83]">{person.id}</p>
        <p className="mt-1 text-sm text-[#8a808c]">
          {settings.currency} {Number(person.unit_price ?? settings.price).toFixed(2)}
        </p>
        {person.phone && <p className="mt-1 text-sm text-[#8a808c]">{person.phone}</p>}
        {person.order_id && <p className="mt-1 text-xs text-[#8a808c]">Compra: {person.order_id}</p>}

        {cancelled ? (
          <div className="mt-3 rounded-xl bg-[#fdecec] px-3 py-2 text-sm text-[#9b2c2c]">
            <p className="font-bold">Compra cancelada</p>
            <p className="mt-0.5 text-xs">Este QR no es válido para ingresar.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#8a808c]">
            Cada QR es de un solo uso y se inhabilita al escanearse.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={download}
            disabled={busy}
            className="flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            <Download className="size-4" /> {busy ? 'Preparando...' : 'Descargar PDF'}
          </button>
          {canShare && (
            <button
              onClick={share}
              disabled={busy}
              className="flex w-full justify-center gap-2 rounded-xl border border-[#ded7d1] bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              <QrCode className="size-4" /> Compartir QR
            </button>
          )}
        </div>
        {message && <p className="mt-3 text-sm font-semibold text-[#5f2d83]">{message}</p>}
      </div>
    </div>
  )
}
