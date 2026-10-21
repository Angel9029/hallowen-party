'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import { BadgeCheck, Check, CircleDollarSign, ClipboardCheck, Download, Home, Menu, Plus, QrCode, Search, Ticket, Users, X } from 'lucide-react'
import jsPDF from 'jspdf'
import type { Attendee, View, Result } from '@/lib/types'

export default function Page() {
  const [view, setView] = useState<View>('inicio')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPaid, setNewPaid] = useState('no')
  const [selected, setSelected] = useState<Attendee | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [scanResult, setScanResult] = useState<Result>(null)
  const [matchedAttendee, setMatchedAttendee] = useState<Attendee | null>(null)
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

  useEffect(() => {
    fetchAttendees()
  }, [])

  const filtered = useMemo(() => attendees.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase())), [attendees, query])
  const stats = { total: attendees.length, paid: attendees.filter((p) => p.paid).length, pending: attendees.filter((p) => !p.paid).length, used: attendees.filter((p) => p.used).length }

  async function addAttendee(event: React.FormEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone: newPhone, paid: newPaid === 'si' }),
      })
      const data = await res.json()
      if (data.attendee) {
        setAttendees((current) => [...current, data.attendee])
        setSelected(data.attendee)
      }
    } catch (e) {
      // ignore
    }
    setNewName('')
    setNewPhone('')
    setNewPaid('no')
    setShowForm(false)
  }

  async function validateCode(code = scanCode) {
    const trimmed = code.trim()
    setScanCode(trimmed)
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
      if (data.attendee?.used) {
        setScanResult('used')
        setMatchedAttendee(data.attendee)
        return
      }
      setScanResult('invalid')
      setMatchedAttendee(data.attendee || null)
    } catch (e) {
      setScanResult('invalid')
      setMatchedAttendee(null)
    }
  }

  async function confirmEntry() {
    const id = scanCode.trim().toUpperCase()
    try {
      const res = await fetch('/api/attendees/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: id }),
      })
      const data = await res.json()
      if (data.success && data.attendee) {
        setAttendees((current) => current.map((p) => (p.id === id ? data.attendee : p)))
        setScanResult('used')
        setMatchedAttendee(data.attendee)
        return
      }
    } catch (e) {
      // ignore
    }
    setAttendees((current) => current.map((p) => (p.id === id ? { ...p, used: true } : p)))
    setScanResult('used')
    const updated = attendees.find((p) => p.id === id)
    setMatchedAttendee(updated ? { ...updated, used: true } : matchedAttendee)
  }

  function handleNavClick(nextView: View) {
    setView(nextView)
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
              <p className="font-bold">Halloween Party</p>
              <p className="text-xs text-[#8a808c]">Panel de entradas</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2" aria-label="Navegación">
            <NavItem icon={<Home />} label="Inicio" active={view === 'inicio'} onClick={() => setView('inicio')} />
            <NavItem icon={<Users />} label="Asistentes" active={view === 'asistentes'} onClick={() => setView('asistentes')} />
            <NavItem icon={<QrCode />} label="Leer entrada" active={view === 'escanear'} onClick={() => setView('escanear')} />
          </nav>
          <div className="mt-auto rounded-2xl bg-[#fff4e9] p-4">
            <p className="text-xs font-semibold text-[#a35c27]">Evento</p>
            <p className="mt-1 font-semibold">31 de octubre, 2026</p>
            <p className="text-sm text-[#8a808c]">S/ 5.00 por entrada</p>
          </div>
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
                    <p className="font-bold">Halloween Party</p>
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
              <div className="mt-auto rounded-2xl bg-[#fff4e9] p-4">
                <p className="text-xs font-semibold text-[#a35c27]">Evento</p>
                <p className="mt-1 font-semibold">31 de octubre, 2026</p>
                <p className="text-sm text-[#8a808c]">S/ 5.00 por entrada</p>
              </div>
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
                <p className="text-sm text-[#8a808c]">Sábado, 31 de octubre de 2026</p>
                <h1 className="text-xl font-bold">{view === 'inicio' ? 'Resumen del evento' : view === 'asistentes' ? 'Asistentes' : 'Control de acceso'}</h1>
              </div>
              <p className="font-bold lg:hidden">Halloween Party</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-[#eadff0] text-sm font-bold text-[#5f2d83]">AD</div>
          </header>
          <div className="p-5 sm:p-8">
            {loading && view === 'inicio' && <div className="mx-auto max-w-[1120px] text-[#756c78]">Cargando...</div>}
            {view === 'inicio' && !loading && <Dashboard stats={stats} onScan={() => setView('escanear')} onAdd={() => setShowForm(true)} />}
            {view === 'asistentes' && <Attendees attendees={filtered} query={query} setQuery={setQuery} onAdd={() => setShowForm(true)} onQr={setSelected} />}
            {view === 'escanear' && <Scanner scanCode={scanCode} setScanCode={setScanCode} scanResult={scanResult} matched={matchedAttendee} onSubmit={(e) => { e.preventDefault(); validateCode() }} onScan={validateCode} onConfirm={confirmEntry} onClear={() => { setScanResult(null); setScanCode(''); setMatchedAttendee(null) }} />}
          </div>
        </section>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#241f2b]/30 p-4 sm:p-5">
          <form onSubmit={addAttendee} className="w-full max-w-md max-h-[90vh] overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Registrar asistente</h2>
                <p className="mt-1 text-sm text-[#8a808c]">Solo necesitas estos datos.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar">
                <X />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold">
                Nombre completo
                <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Ana López" className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none focus:border-[#5f2d83]" />
              </label>
              <label className="text-sm font-semibold">
                Teléfono <span className="font-normal text-[#8a808c]">(opcional)</span>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Ej. 987 654 321" className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 font-normal outline-none focus:border-[#5f2d83]" inputMode="tel" />
              </label>
              <label className="text-sm font-semibold">
                ¿Pagó?
                <select value={newPaid} onChange={(e) => setNewPaid(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ded7d1] bg-white px-4 py-3 font-normal outline-none focus:border-[#5f2d83]">
                  <option value="no">No, pendiente</option>
                  <option value="si">Sí, pagado</option>
                </select>
              </label>
            </div>
            <button className="mt-6 flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-semibold text-white" type="submit">
              <Plus /> Registrar y generar QR
            </button>
          </form>
        </div>
      )}
      {selected && <QrModal person={selected} onClose={() => setSelected(null)} />}
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

function Dashboard({ stats, onScan, onAdd }: { stats: { total: number; paid: number; pending: number; used: number }; onScan: () => void; onAdd: () => void }) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-[#fff0df] px-3 py-1 text-xs font-bold text-[#a35c27]">Evento en preparación</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Todo listo para recibirlos</h2>
          <p className="mt-2 text-[#756c78]">Registra, genera y lee entradas en un solo lugar.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onAdd} className="flex gap-2 rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold">
            <Plus /> Registrar
          </button>
          <button onClick={onScan} className="flex gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 text-sm font-bold text-white">
            <QrCode /> Leer QR
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Asistentes" value={stats.total} note="registrados" icon={<Users />} />
        <Stat label="Pagadas" value={stats.paid} note="listas" icon={<BadgeCheck />} />
        <Stat label="Por cobrar" value={stats.pending} note={`S/ ${(stats.pending * 5).toFixed(2)}`} icon={<CircleDollarSign />} />
        <Stat label="Ingresaron" value={stats.used} note={`de ${stats.paid}`} icon={<ClipboardCheck />} />
      </div>
      <div className="mt-6 rounded-2xl border border-[#e7e0da] bg-white p-6">
        <h3 className="font-bold">Cómo funciona</h3>
        <div className="mt-4 grid gap-3 text-sm text-[#756c78] sm:grid-cols-3">
          <p>
            <b className="text-[#241f2b]">1.</b> Registra a la persona y marca si pagó.
          </p>
          <p>
            <b className="text-[#241f2b]">2.</b> Comparte o descarga su QR.
          </p>
          <p>
            <b className="text-[#241f2b]">3.</b> Lee el QR al ingresar y confirma.
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

function Attendees({ attendees, query, setQuery, onAdd, onQr }: { attendees: Attendee[]; query: string; setQuery: (v: string) => void; onAdd: () => void; onQr: (p: Attendee) => void }) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold">Asistentes</h2>
          <p className="mt-2 text-[#756c78]">Cada persona tiene una entrada QR.</p>
        </div>
        <button onClick={onAdd} className="flex justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 text-sm font-bold text-white">
          <Plus /> Nuevo asistente
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#e7e0da] bg-white">
        <div className="border-b border-[#eee8e3] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f2] px-4 py-3">
            <Search className="text-[#8a808c]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o número..." className="w-full bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="divide-y divide-[#eee8e3]">
          {attendees.map((p) => (
            <div key={p.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_120px_110px] sm:items-center">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-[#8a808c]">{p.phone || 'Sin teléfono'}</p>
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

function QrModal({ person, onClose }: { person: Attendee; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current && typeof window !== 'undefined') {
      QRCode.toCanvas(canvasRef.current, person.id, { width: Math.min(260, window.innerWidth - 80), margin: 2 })
    }
  }, [person])

  function downloadPdf() {
    if (!canvasRef.current) return
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const qrSize = 70
      const qrX = (pageWidth - qrSize) / 2
      const imgData = canvasRef.current.toDataURL('image/png')
      doc.setFontSize(18)
      doc.text('Halloween Party', pageWidth / 2, 30, { align: 'center' })
      doc.setFontSize(12)
      doc.text('Control de entradas', pageWidth / 2, 38, { align: 'center' })
      doc.addImage(imgData, 'PNG', qrX, 55, qrSize, qrSize)
      doc.setFontSize(14)
      doc.text(person.name, pageWidth / 2, 140, { align: 'center' })
      doc.setFontSize(12)
      doc.text(`ID: ${person.id}`, pageWidth / 2, 150, { align: 'center' })
      if (person.phone) {
        doc.text(`Teléfono: ${person.phone}`, pageWidth / 2, 158, { align: 'center' })
      }
      doc.save(`entrada-${person.id}.pdf`)
    } catch (e) {
      // ignore
    }
  }

  function share() {
    if (canvasRef.current && typeof navigator !== 'undefined' && 'share' in navigator) {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return
        try {
          const file = new File([blob], `entrada-${person.id}.png`, { type: 'image/png' })
          await navigator.share({ files: [file], title: `Entrada ${person.id}`, text: `Entrada de ${person.name}` })
        } catch (e) {
          // ignore
        }
      }, 'image/png')
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#241f2b]/40 p-4 sm:p-5">
      <div className="w-full max-w-sm max-h-[90vh] overflow-auto rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <p className="text-sm text-[#8a808c]">Entrada de</p>
        <h2 className="text-xl font-bold break-words">{person.name}</h2>
        <canvas ref={canvasRef} className="mx-auto my-5 max-w-full" aria-label={`Código QR de ${person.name}`} />
        <p className="font-bold text-[#5f2d83]">{person.id}</p>
        {person.phone && <p className="mt-1 text-sm text-[#8a808c]">{person.phone}</p>}
        <p className="mt-1 text-sm text-[#8a808c]">Descarga en PDF con los datos del invitado.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={downloadPdf} className="flex w-full justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white">
            <Download /> Descargar PDF
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button onClick={share} className="flex w-full justify-center gap-2 rounded-xl border border-[#dcd4cf] bg-white px-4 py-3 text-sm font-bold">
              <QrCode /> Compartir QR
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Scanner({ scanCode, setScanCode, scanResult, matched, onSubmit, onScan, onConfirm, onClear }: { scanCode: string; setScanCode: (v: string) => void; scanResult: Result; matched: Attendee | null; onSubmit: (e: React.FormEvent) => void; onScan: (code: string) => void; onConfirm: () => void; onClear: () => void }) {
  const reader = useRef<Html5Qrcode | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [requested, setRequested] = useState(false)

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

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-7">
        <h2 className="text-3xl font-bold">Control de acceso</h2>
        <p className="mt-2 text-[#756c78]">Lee el QR con la cámara o escribe el código.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-[#241f2b] p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Lector de cámara</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${cameraReady ? 'bg-[#315f42]' : cameraError ? 'bg-[#7c2d12]' : requested ? 'bg-[#6b7280]' : 'bg-[#5f2d83]'}`}>{cameraReady ? 'Activo' : cameraError ? 'Sin permiso' : requested ? 'Solicitando...' : 'Requiere permiso'}</span>
          </div>
          {!requested && !cameraReady && (
            <button onClick={startScanner} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#241f2b]">
              Activar cámara y escanear
            </button>
          )}
          <div id="qr-reader" className={`mt-5 overflow-hidden rounded-2xl bg-white text-[#241f2b] [&>video]:w-full [&>video]:h-auto ${requested ? '' : 'hidden'}`} />
          <p className="mt-4 text-center text-sm text-[#cfc1d5]">{cameraError ? cameraError : cameraReady ? 'Escanea el código QR' : requested ? 'Acepta el permiso de cámara cuando aparezca el diálogo' : 'Pulsa el botón para solicitar acceso a la cámara'}</p>
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
              Número de entrada
              <input value={scanCode} onChange={(e) => setScanCode(e.target.value)} placeholder="Ej. HP-001" className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 outline-none focus:border-[#5f2d83]" inputMode="text" autoCapitalize="characters" />
            </label>
            <button className="rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white" type="submit">
              Validar entrada
            </button>
          </form>
          {scanResult && (
            <div className={`mt-6 rounded-2xl p-4 ${scanResult === 'valid' ? 'bg-[#e5f5eb]' : scanResult === 'used' ? 'bg-[#f0e9f4]' : 'bg-[#fff0df]'}`}>
              <p className="font-bold">{scanResult === 'valid' ? 'Entrada válida' : scanResult === 'used' ? 'Entrada ya utilizada' : 'Entrada no válida o pendiente de pago'}</p>
              {matched && (
                <div className="mt-3 text-sm space-y-1">
                  <p><span className="font-semibold">Invitado:</span> {matched.name}</p>
                  <p><span className="font-semibold">Código:</span> {matched.id}</p>
                  {matched.phone && <p><span className="font-semibold">Celular:</span> {matched.phone}</p>}
                  <p><span className="font-semibold">Estado:</span> {matched.used ? 'Ya utilizada' : matched.paid ? 'Pagada' : 'Pendiente'}</p>
                </div>
              )}
              {scanResult === 'valid' && (
                <button onClick={onConfirm} className="mt-3 flex gap-2 rounded-xl bg-[#2e8a54] px-4 py-2 text-sm font-bold text-white">
                  <Check /> Aceptar ingreso
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
