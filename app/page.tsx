'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import {
  BadgeCheck,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Home,
  Menu,
  Plus,
  QrCode,
  Search,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import type { Attendee, EventSettings, Result, View } from '@/lib/types'
import { PurchaseModal } from '@/components/purchase-modal'
import { downloadTicketsPdf, shareTicketsPdf } from '@/lib/ticket-pdf'

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

export default function Page() {
  const [view, setView] = useState<View>('inicio')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [settings, setSettings] = useState<EventSettings>(FALLBACK_SETTINGS)
  const [query, setQuery] = useState('')
  const [showPurchase, setShowPurchase] = useState(false)
  const [selected, setSelected] = useState<Attendee | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [scanResult, setScanResult] = useState<Result>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [matchedAttendee, setMatchedAttendee] = useState<Attendee | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAttendees = async () => {
    try {
      const res = await fetch('/api/attendees')
      const data = await res.json()
      if (data.attendees) {
        setAttendees(data.attendees)
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    fetchAttendees()
    fetchSettings()
  }, [])

  const filtered = useMemo(
    () => attendees.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase())),
    [attendees, query]
  )

  const stats = useMemo(() => {
    const total = attendees.length
    const paid = attendees.filter((p) => p.paid).length
    const pending = total - paid
    const used = attendees.filter((p) => p.used).length
    const collected = attendees
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + Number(p.unit_price ?? settings.price), 0)
    const pendingAmount = attendees
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + Number(p.unit_price ?? settings.price), 0)

    return { total, paid, pending, used, collected, pendingAmount }
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
    } catch (e) {
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
        setAttendees((current) => current.map((p) => (p.id === id ? data.attendee : p)))
        setMatchedAttendee(data.attendee)
        setScanResult('checked')
        setScanMessage('Ingreso registrado. Esta entrada quedó inhabilitada.')
        return
      }

      if (data.attendee) {
        setAttendees((current) => current.map((p) => (p.id === id ? data.attendee : p)))
        setMatchedAttendee(data.attendee)
      }

      setScanResult(data.reason === 'already_used' ? 'used' : 'invalid')
      setScanMessage(data.error || 'No se pudo registrar el ingreso.')
    } catch (e) {
      setScanMessage('No se pudo conectar con el servidor.')
    } finally {
      setConfirming(false)
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
    <main className="min-h-screen bg-[#f7f5f2] text-[#241f2b]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e7e0da] bg-white px-5 py-6 lg:flex">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="grid size-10 place-items-center rounded-xl bg-[#5f2d83] text-white">
              <Ticket />
            </div>
            <div>
              <p className="font-bold">{settings.event_name}</p>
              <p className="text-xs text-[#8a808c]">Panel de entradas</p>
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
            <div className="absolute inset-0 bg-[#241f2b]/40" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
            <aside className="relative flex h-full w-[280px] flex-col border-r border-[#e7e0da] bg-white px-5 py-6 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3 px-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#5f2d83] text-white">
                    <Ticket />
                  </div>
                  <div>
                    <p className="font-bold">{settings.event_name}</p>
                    <p className="text-xs text-[#8a808c]">Panel de entradas</p>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" className="rounded-lg p-2">
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
          <header className="flex h-[76px] items-center justify-between border-b border-[#e7e0da] bg-white px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 lg:hidden" aria-label="Abrir menú">
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
            <div className="grid size-9 place-items-center rounded-full bg-[#eadff0] text-sm font-bold text-[#5f2d83]">AD</div>
          </header>

          <div className="p-5 sm:p-8">
            {loading && view === 'inicio' && <div className="mx-auto max-w-[1120px] text-[#756c78]">Cargando...</div>}
            {view === 'inicio' && !loading && (
              <Dashboard stats={stats} settings={settings} onScan={() => setView('escanear')} onPurchase={openPurchase} />
            )}
            {view === 'asistentes' && (
              <Attendees
                attendees={filtered}
                settings={settings}
                query={query}
                setQuery={setQuery}
                onPurchase={openPurchase}
                onQr={setSelected}
              />
            )}
            {view === 'escanear' && (
              <Scanner
                scanCode={scanCode}
                setScanCode={setScanCode}
                scanResult={scanResult}
                scanMessage={scanMessage}
                matched={matchedAttendee}
                confirming={confirming}
                onSubmit={(e) => {
                  e.preventDefault()
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

      {selected && <QrModal person={selected} settings={settings} onClose={() => setSelected(null)} />}
    </main>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${active ? 'bg-[#f0e9f4] text-[#5f2d83]' : 'text-[#756c78] hover:bg-[#f7f5f2]'}`}>
      {icon}
      {label}
    </button>
  )
}

function EventCard({ settings, eventDate, onSavePrice }: { settings: EventSettings; eventDate: string; onSavePrice: (price: number) => Promise<void> }) {
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
    <div className="mt-auto rounded-2xl bg-[#fff4e9] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#a35c27]">Evento</p>
        <button onClick={() => setEditing((v) => !v)} className="text-xs font-bold text-[#a35c27] underline">
          {editing ? 'Cancelar' : 'Editar precio'}
        </button>
      </div>
      <p className="mt-1 font-semibold">{eventDate}</p>

      {!editing ? (
        <>
          <p className="text-sm text-[#8a808c]">
            {settings.currency} {settings.price.toFixed(2)} por entrada
          </p>
          <p className="mt-2 text-xs text-[#a35c27]">El precio se actualiza sin reiniciar la app.</p>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{settings.currency}</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-[#e7d6c6] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#5f2d83]"
              autoFocus
            />
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-[#5f2d83] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar precio'}
          </button>
          <p className="text-xs text-[#8a808c]">Se aplica a las próximas ventas.</p>
          {error && <p className="text-xs font-semibold text-[#a35c27]">{error}</p>}
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
}

function Dashboard({ stats, settings, onScan, onPurchase }: { stats: Stats; settings: EventSettings; onScan: () => void; onPurchase: () => void }) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-[#fff0df] px-3 py-1 text-xs font-bold text-[#a35c27]">Evento en preparación</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Todo listo para recibirlos</h2>
          <p className="mt-2 text-[#756c78]">
            Vende una o varias entradas y entrega un PDF con todos los QR.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onScan} className="flex gap-2 rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold">
            <QrCode /> Leer QR
          </button>
          <button onClick={onPurchase} className="flex gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 text-sm font-bold text-white">
            <Plus /> Vender entradas
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Entradas" value={stats.total} note="generadas" icon={<Users />} />
        <Stat
          label="Pagadas"
          value={stats.paid}
          note={`${settings.currency} ${stats.collected.toFixed(2)}`}
          icon={<BadgeCheck />}
        />
        <Stat
          label="Por cobrar"
          value={stats.pending}
          note={`${settings.currency} ${stats.pendingAmount.toFixed(2)}`}
          icon={<CircleDollarSign />}
        />
        <Stat label="Ingresaron" value={stats.used} note={`de ${stats.paid}`} icon={<ClipboardCheck />} />
      </div>

      <div className="mt-6 rounded-2xl border border-[#e7e0da] bg-white p-6">
        <h3 className="font-bold">Cómo funciona</h3>
        <div className="mt-4 grid gap-3 text-sm text-[#756c78] sm:grid-cols-4">
          <p>
            <b className="text-[#241f2b]">1.</b> Define el precio del evento.
          </p>
          <p>
            <b className="text-[#241f2b]">2.</b> Vende una o varias entradas.
          </p>
          <p>
            <b className="text-[#241f2b]">3.</b> Descarga el PDF con todos los QR.
          </p>
          <p>
            <b className="text-[#241f2b]">4.</b> Escanea: cada QR se inhabilita al ingresar.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, note, icon }: { label: string; value: number; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e7e0da] bg-white p-5">
      <div className="mb-5 grid size-10 place-items-center rounded-xl bg-[#f0e9f4] text-[#5f2d83]">{icon}</div>
      <p className="text-sm text-[#8a808c]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-xs text-[#8a808c]">{note}</span>
      </div>
    </div>
  )
}

function Attendees({
  attendees,
  settings,
  query,
  setQuery,
  onPurchase,
  onQr,
}: {
  attendees: Attendee[]
  settings: EventSettings
  query: string
  setQuery: (v: string) => void
  onPurchase: () => void
  onQr: (p: Attendee) => void
}) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold">Asistentes</h2>
          <p className="mt-2 text-[#756c78]">Cada fila es una entrada con su propio QR y validez.</p>
        </div>
        <button onClick={onPurchase} className="flex justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 text-sm font-bold text-white">
          <Plus /> Vender entradas
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e7e0da] bg-white">
        <div className="border-b border-[#eee8e3] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f2] px-4 py-3">
            <Search className="text-[#8a808c]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {attendees.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-[#8a808c]">Todavía no hay entradas registradas.</p>
        )}

        <div className="divide-y divide-[#eee8e3]">
          {attendees.map((p) => (
            <div key={p.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_130px_120px_110px] sm:items-center">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-[#8a808c]">{p.phone || 'Sin teléfono'}</p>
                <p className="text-xs text-[#8a808c]">
                  {settings.currency} {Number(p.unit_price ?? settings.price).toFixed(2)}
                  {p.order_id ? ` · ${p.order_id}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-[#5f2d83]">{p.id}</span>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${p.used ? 'bg-[#f0e9f4] text-[#5f2d83]' : p.paid ? 'bg-[#e5f5eb] text-[#2e8a54]' : 'bg-[#fff8d8] text-[#a68300]'}`}>
                {p.used ? 'Utilizada' : p.paid ? 'Pagada' : 'Pendiente'}
              </span>
              <button onClick={() => onQr(p)} className="flex items-center gap-2 text-sm font-bold text-[#5f2d83]">
                <QrCode /> Ver QR
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QrModal({ person, settings, onClose }: { person: Attendee; settings: EventSettings; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (canvasRef.current && typeof window !== 'undefined') {
      QRCode.toCanvas(canvasRef.current, person.id, { width: Math.min(260, window.innerWidth - 80), margin: 2 })
    }
  }, [person.id])

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

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
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#241f2b]/40 p-4 sm:p-5">
      <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <p className="text-sm text-[#8a808c]">Entrada de</p>
        <h2 className="break-words text-xl font-bold">{person.name}</h2>
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${person.used ? 'bg-[#f0e9f4] text-[#5f2d83]' : person.paid ? 'bg-[#e5f5eb] text-[#2e8a54]' : 'bg-[#fff8d8] text-[#a68300]'}`}>
          {person.used ? 'Utilizada' : person.paid ? 'Pagada' : 'Pendiente'}
        </span>
        <canvas ref={canvasRef} className="mx-auto my-5 max-w-full" aria-label={`Código QR de ${person.name}`} />
        <p className="font-bold text-[#5f2d83]">{person.id}</p>
        <p className="mt-1 text-sm text-[#8a808c]">
          {settings.currency} {Number(person.unit_price ?? settings.price).toFixed(2)}
        </p>
        {person.phone && <p className="mt-1 text-sm text-[#8a808c]">{person.phone}</p>}
        <p className="mt-3 text-sm text-[#8a808c]">Cada QR es de un solo uso y se inhabilita al escanearse.</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={download}
            disabled={busy}
            className="flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            <Download /> {busy ? 'Preparando...' : 'Descargar PDF'}
          </button>
          {canShare && (
            <button
              onClick={share}
              disabled={busy}
              className="flex w-full justify-center gap-2 rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              <QrCode /> Compartir QR
            </button>
          )}
        </div>
        {message && <p className="mt-3 text-sm font-semibold text-[#5f2d83]">{message}</p>}
      </div>
    </div>
  )
}

function Scanner({
  scanCode,
  setScanCode,
  scanResult,
  scanMessage,
  matched,
  confirming,
  onSubmit,
  onScan,
  onConfirm,
  onClear,
}: {
  scanCode: string
  setScanCode: (v: string) => void
  scanResult: Result
  scanMessage: string | null
  matched: Attendee | null
  confirming: boolean
  onSubmit: (e: React.FormEvent) => void
  onScan: (code: string) => void
  onConfirm: () => void
  onClear: () => void
}) {
  const reader = useRef<Html5Qrcode | null>(null)
  const lastScan = useRef<{ code: string; at: number } | null>(null)
  const resultRef = useRef<Result>(scanResult)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    resultRef.current = scanResult
  }, [scanResult])

  const startScanner = async () => {
    setCameraError(null)
    setCameraReady(false)
    setRequested(true)
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        stream.getTracks().forEach((t) => t.stop())
      } else {
        throw new Error('Este navegador no soporta acceso a cámara')
      }
    } catch (e: any) {
      setCameraError(e?.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Actívalo en la configuración del navegador.' : e?.message || 'No se pudo acceder a la cámara')
      return
    }

    try {
      const scanner = new Html5Qrcode('qr-reader')
      reader.current = scanner
      await scanner.start(
        { facingMode: { ideal: 'environment' } },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.floor(minEdge * 0.7)
            return { width: size, height: size }
          },
        },
        (decoded) => {
          // Mientras hay un resultado en pantalla no seguimos validando el
          // mismo QR. El operador debe pulsar "Limpiar" para el siguiente.
          if (resultRef.current) return
          const now = Date.now()
          if (lastScan.current && lastScan.current.code === decoded && now - lastScan.current.at < 3000) return
          lastScan.current = { code: decoded, at: now }
          onScan(decoded)
        },
        () => {}
      )
      setCameraReady(true)
    } catch (e: any) {
      setCameraError(e?.message || 'Error al iniciar el lector de cámara')
    }
  }

  useEffect(() => {
    return () => {
      ;(async () => {
        try {
          const r = reader.current
          if (r) {
            const maybe = (r as any).isScanning
            if (maybe) {
              try {
                await (r as any).stop()
              } catch (e) {}
            }
            try {
              await (r as any).clear()
            } catch (e) {}
          }
        } catch (e) {
          // ignore
        }
      })()
    }
  }, [])

  const panelTone =
    scanResult === 'valid' || scanResult === 'checked'
      ? 'bg-[#e5f5eb]'
      : scanResult === 'used'
        ? 'bg-[#f0e9f4]'
        : 'bg-[#fff0df]'

  const resultTitle =
    scanResult === 'valid'
      ? 'Entrada válida'
      : scanResult === 'checked'
        ? 'Ingreso registrado'
        : scanResult === 'used'
          ? 'Entrada ya utilizada'
          : 'Entrada no válida'

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-7">
        <h2 className="text-3xl font-bold">Control de acceso</h2>
        <p className="mt-2 text-[#756c78]">Lee el QR con la cámara o escribe el código. Cada entrada se inhabilita al ingresar.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-[#241f2b] p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Lector de cámara</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${cameraReady ? 'bg-[#315f42]' : cameraError ? 'bg-[#7c2d12]' : requested ? 'bg-[#6b7280]' : 'bg-[#5f2d83]'}`}>
              {cameraReady ? 'Activo' : cameraError ? 'Sin permiso' : requested ? 'Solicitando...' : 'Requiere permiso'}
            </span>
          </div>

          {!requested && !cameraReady && (
            <button onClick={startScanner} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#241f2b]">
              Activar cámara y escanear
            </button>
          )}

          <div id="qr-reader" className={`mt-5 overflow-hidden rounded-2xl bg-white text-[#241f2b] [&>video]:w-full [&>video]:h-auto ${requested ? '' : 'hidden'}`} />
          <p className="mt-4 text-center text-sm text-[#cfc1d5]">
            {cameraError ? cameraError : cameraReady ? 'Escanea el código QR' : requested ? 'Acepta el permiso de cámara cuando aparezca el diálogo' : 'Pulsa el botón para solicitar acceso a la cámara'}
          </p>

          {(cameraError || (requested && !cameraReady && !cameraError)) && (
            <button onClick={startScanner} className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#241f2b]">
              Solicitar permiso nuevamente
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-[#e7e0da] bg-white p-6">
          <h3 className="font-bold">Código manual</h3>
          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
            <label className="text-sm font-semibold">
              Código de entrada
              <input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="Ej. HP-0001"
                className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 uppercase outline-none focus:border-[#5f2d83]"
                inputMode="text"
                autoCapitalize="characters"
              />
            </label>
            <button className="rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white" type="submit">
              Validar entrada
            </button>
          </form>

          {scanResult && (
            <div className={`mt-6 rounded-2xl p-4 ${panelTone}`}>
              <p className="font-bold">{resultTitle}</p>
              {scanMessage && <p className="mt-1 text-sm text-[#756c78]">{scanMessage}</p>}
              {matched && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    <span className="font-semibold">Invitado:</span> {matched.name}
                  </p>
                  <p>
                    <span className="font-semibold">Código:</span> {matched.id}
                  </p>
                  {matched.phone && (
                    <p>
                      <span className="font-semibold">Celular:</span> {matched.phone}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold">Estado:</span>{' '}
                    {matched.used ? 'Utilizada' : matched.paid ? 'Pagada' : 'Pendiente'}
                  </p>
                </div>
              )}
              {scanResult === 'valid' && (
                <button
                  onClick={onConfirm}
                  disabled={confirming}
                  className="mt-3 flex gap-2 rounded-xl bg-[#2e8a54] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Check /> {confirming ? 'Registrando...' : 'Aceptar ingreso'}
                </button>
              )}
              <button onClick={onClear} className="mt-3 block text-sm font-semibold underline">
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
