'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Ban,
  Check,
  CheckCircle2,
  CircleAlert,
  Flashlight,
  Ghost,
  Loader2,
  PartyPopper,
  QrCode,
  ScanLine,
  X,
  XCircle,
} from 'lucide-react'
import type { Attendee, EventSettings, Result } from '@/lib/types'
import { formatDateTime } from '@/lib/purchases'

type Props = {
  settings: EventSettings
  scanCode: string
  setScanCode: (v: string) => void
  scanResult: Result
  scanMessage: string | null
  matched: Attendee | null
  confirming: boolean
  orderProgress: { used: number; total: number } | null
  onSubmit: (e: React.FormEvent) => void
  onScan: (code: string) => void
  onConfirm: () => void
  onClear: () => void
}

function describeCameraError(error: unknown) {
  const e = error as { name?: string; message?: string }
  const name = e?.name || ''

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Permiso de cámara bloqueado para este sitio. Pulsa el candado junto a la URL y elige "Permitir", luego recarga. En iPhone: Ajustes > Safari > Cámara > Permitir.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No se encontró ninguna cámara conectada a este dispositivo.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'La cámara está siendo usada por otra aplicación (Zoom, Meet, otra pestaña). Ciérrala y vuelve a intentar.'
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'La cámara disponible no es compatible. Prueba con otra cámara o desde otro navegador.'
  }
  return e?.message?.trim() || 'No se pudo iniciar la cámara. Revisa los permisos del sitio e inténtalo de nuevo.'
}

function statusLabel(attendee: Attendee | null) {
  if (!attendee) return 'No registrada'
  if (attendee.cancelled_at) return 'Compra cancelada'
  if (attendee.used) return 'Ya utilizada'
  if (!attendee.paid) return 'Pendiente de pago'
  return 'Válida'
}

export function Scanner({
  settings,
  scanCode,
  setScanCode,
  scanResult,
  scanMessage,
  matched,
  confirming,
  orderProgress,
  onSubmit,
  onScan,
  onConfirm,
  onClear,
}: Props) {
  const reader = useRef<Html5Qrcode | null>(null)
  const starting = useRef(false)
  const paused = useRef(false)
  const pending = useRef(false)
  const lastScan = useRef<{ code: string; at: number } | null>(null)
  const resultRef = useRef<Result>(scanResult)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [requested, setRequested] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    resultRef.current = scanResult
    if (scanResult) pending.current = false
  }, [scanResult])

  // Pausa el escaneo mientras el modal de resultado está abierto.
  useEffect(() => {
    const scanner = reader.current
    if (!scanner || !cameraReady) return

    try {
      if (scanResult && !paused.current) {
        scanner.pause(true)
        paused.current = true
      } else if (!scanResult && paused.current) {
        scanner.resume()
        paused.current = false
      }
    } catch {
      // El lector pudo haberse detenido entre render y render.
    }
  }, [scanResult, cameraReady])

  const stopScanner = async () => {
    const scanner = reader.current
    reader.current = null
    paused.current = false
    setTorchSupported(false)
    setTorchOn(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {
      // La cámara pudo haberse cerrado ya.
    }
    try {
      scanner.clear()
    } catch {
      // ignore
    }
  }

  const startScanner = async () => {
    if (starting.current) return
    starting.current = true
    setCameraError(null)
    setCameraReady(false)
    setRequested(true)

    try {
      // Libera una instancia anterior antes de volver a pedir la cámara.
      await stopScanner()

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error(
          'La cámara solo funciona en HTTPS. Abre la URL de Vercel (https://...) o http://localhost; no uses una IP por HTTP.'
        )
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no permite acceder a la cámara.')
      }

      // El contenedor debe estar visible antes de arrancar el lector.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )

      const scanner = new Html5Qrcode('qr-reader')
      reader.current = scanner

      const config = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          const size = Math.floor(minEdge * 0.7)
          return { width: size, height: size }
        },
      }

      const onDecoded = (decoded: string) => {
        // Mientras hay un resultado en pantalla o una validación en curso no
        // seguimos leyendo. El operador debe cerrar el modal para continuar.
        if (resultRef.current || pending.current) return
        const now = Date.now()
        if (lastScan.current && lastScan.current.code === decoded && now - lastScan.current.at < 3000) {
          return
        }
        lastScan.current = { code: decoded, at: now }
        pending.current = true
        onScan(decoded)
      }

      try {
        await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {})
      } catch (firstError) {
        // Portátiles o cámaras sin "environment": usa la que exista.
        await stopScanner()
        const cameras = await Html5Qrcode.getCameras().catch(() => [])
        if (!cameras.length) throw firstError
        const retry = new Html5Qrcode('qr-reader')
        reader.current = retry
        await retry.start(cameras[cameras.length - 1].id, config, onDecoded, () => {})
      }

      setCameraReady(true)

      try {
        const caps = reader.current?.getRunningTrackCameraCapabilities()
        setTorchSupported(Boolean(caps?.torchFeature().isSupported()))
      } catch {
        setTorchSupported(false)
      }
    } catch (e) {
      await stopScanner()
      setCameraError(describeCameraError(e))
    } finally {
      starting.current = false
    }
  }

  useEffect(() => {
    return () => {
      void stopScanner()
    }
    // Solo al desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleTorch() {
    const scanner = reader.current
    if (!scanner) return
    try {
      const feature = scanner.getRunningTrackCameraCapabilities().torchFeature()
      if (!feature.isSupported()) return
      await feature.apply(!torchOn)
      setTorchOn((value) => !value)
    } catch {
      // Algunos navegadores dicen soportarlo pero fallan al aplicarlo.
    }
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-7">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#2a1638] px-3 py-1 text-xs font-bold text-[#ffd08a]">
          <ScanLine className="size-3.5" /> Control de acceso
        </p>
        <h2 className="text-3xl font-bold tracking-tight">Leer entrada</h2>
        <p className="mt-2 text-[#756c78]">
          El resultado aparece en un modal y la cámara se pausa hasta que aceptes o cierres.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1638] via-[#1e0f2b] to-[#120818] p-5 text-white shadow-xl sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#f0a23a]/20 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-bold">
              <QrCode className="size-4 text-[#ffb35c]" /> Lector de cámara
            </h3>
            <div className="flex items-center gap-2">
              {cameraReady && torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-pressed={torchOn}
                  className={`grid size-8 place-items-center rounded-full border transition ${
                    torchOn
                      ? 'border-[#ffb35c] bg-[#ffb35c] text-[#2a1638]'
                      : 'border-white/20 text-white/80 hover:bg-white/10'
                  }`}
                  title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                >
                  <Flashlight className="size-4" />
                </button>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  cameraReady
                    ? 'bg-[#2e8a54] text-white'
                    : cameraError
                      ? 'bg-[#9b2c2c] text-white'
                      : requested
                        ? 'bg-white/15 text-white/80'
                        : 'bg-[#5f2d83] text-white'
                }`}
              >
                {cameraReady ? 'Activo' : cameraError ? 'Error' : requested ? 'Solicitando...' : 'Requiere permiso'}
              </span>
            </div>
          </div>

          {!cameraReady && (
            <button
              onClick={startScanner}
              className="relative mt-5 w-full rounded-xl bg-[#f0a23a] px-4 py-3 text-sm font-bold text-[#2a1638] transition hover:bg-[#ffb35c]"
            >
              {cameraError
                ? 'Reintentar cámara'
                : requested
                  ? 'Solicitar permiso nuevamente'
                  : 'Activar cámara y escanear'}
            </button>
          )}

          <div className="relative mt-4 overflow-hidden rounded-2xl border-2 border-[#f0a23a]/40 bg-black">
            <div
              id="qr-reader"
              className={`text-[#241f2b] [&>video]:h-auto [&>video]:w-full ${requested ? '' : 'hidden'}`}
            />
            {!requested && (
              <div className="grid aspect-square place-items-center bg-gradient-to-br from-[#2a1638] to-[#120818] text-center">
                <div className="p-6">
                  <Ghost className="mx-auto size-12 animate-floaty text-[#ffb35c]/70" />
                  <p className="mt-3 text-sm text-white/60">La cámara se activa con el botón de arriba</p>
                </div>
              </div>
            )}
          </div>

          <p className="relative mt-4 text-center text-sm text-[#cfc1d5]">
            {cameraError
              ? cameraError
              : cameraReady
                ? 'Apunta al QR. La cámara se pausa al mostrar el resultado.'
                : requested
                  ? 'Acepta el permiso de cámara cuando aparezca el diálogo'
                  : 'También puedes escribir el código a la derecha'}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e7dccd] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="flex items-center gap-2 font-bold">
            <Ghost className="size-4 text-[#5f2d83]" /> Código manual
          </h3>
          <p className="mt-1 text-sm text-[#8a808c]">Útil si el QR está dañado o no hay cámara.</p>
          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
            <label className="text-sm font-semibold">
              Código de entrada
              <input
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="Ej. HP-0001"
                className="mt-2 w-full rounded-xl border border-[#ded7d1] px-4 py-3 uppercase outline-none transition focus:border-[#5f2d83] focus:ring-4 focus:ring-[#5f2d83]/10"
                inputMode="text"
                autoCapitalize="characters"
              />
            </label>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5f2d83] px-4 py-3 font-bold text-white transition hover:bg-[#4c2370]"
              type="submit"
            >
              <ScanLine className="size-4" /> Validar entrada
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-[#faf6ef] p-4 text-sm text-[#756c78]">
            <p className="font-semibold text-[#241f2b]">Cómo funciona</p>
            <ul className="mt-2 space-y-1.5">
              <li>1. Escanea o escribe el código.</li>
              <li>2. Revisa los datos en el modal.</li>
              <li>3. Pulsa “Aceptar ingreso” para inhabilitar ese QR.</li>
            </ul>
          </div>
        </div>
      </div>

      {scanResult && (
        <ResultModal
          result={scanResult}
          message={scanMessage}
          attendee={matched}
          scanCode={scanCode}
          settings={settings}
          confirming={confirming}
          orderProgress={orderProgress}
          onConfirm={onConfirm}
          onClose={onClear}
        />
      )}
    </div>
  )
}

const RESULT_STYLES: Record<
  Exclude<Result, null>,
  {
    title: string
    subtitle: string
    header: string
    iconBg: string
    Icon: typeof CheckCircle2
  }
> = {
  valid: {
    title: 'Entrada válida',
    subtitle: 'Todo listo para recibir a esta persona.',
    header: 'from-[#155e3a] via-[#12522f] to-[#0d3c24]',
    iconBg: 'bg-white/15 text-[#a7f3c4]',
    Icon: CheckCircle2,
  },
  checked: {
    title: '¡Adelante!',
    subtitle: 'Ingreso registrado. Este QR ya no puede volver a usarse.',
    header: 'from-[#2e8a54] via-[#247246] to-[#155e3a]',
    iconBg: 'bg-white/15 text-white',
    Icon: PartyPopper,
  },
  used: {
    title: 'Entrada ya utilizada',
    subtitle: 'Esta entrada ya ingresó antes.',
    header: 'from-[#8a5a06] via-[#6f4704] to-[#4d3102]',
    iconBg: 'bg-white/15 text-[#ffe0a3]',
    Icon: CircleAlert,
  },
  cancelled: {
    title: 'Compra cancelada',
    subtitle: 'Esta compra fue anulada. El QR no es válido.',
    header: 'from-[#8f1d1d] via-[#721616] to-[#4c0e0e]',
    iconBg: 'bg-white/15 text-[#ffc9c9]',
    Icon: Ban,
  },
  invalid: {
    title: 'Entrada no válida',
    subtitle: 'No encontramos una entrada válida con este código.',
    header: 'from-[#8f1d1d] via-[#721616] to-[#4c0e0e]',
    iconBg: 'bg-white/15 text-[#ffc9c9]',
    Icon: XCircle,
  },
}

function ResultModal({
  result,
  message,
  attendee,
  scanCode,
  settings,
  confirming,
  orderProgress,
  onConfirm,
  onClose,
}: {
  result: Exclude<Result, null>
  message: string | null
  attendee: Attendee | null
  scanCode: string
  settings: EventSettings
  confirming: boolean
  orderProgress: { used: number; total: number } | null
  onConfirm: () => void
  onClose: () => void
}) {
  const style = RESULT_STYLES[result]
  const Icon = style.Icon
  const valid = result === 'valid'
  const checked = result === 'checked'

  // Mantiene el cierre actualizado sin reiniciar los temporizadores cuando
  // el panel vuelve a renderizar (por ejemplo, al actualizar el progreso).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (valid) navigator.vibrate(45)
      else if (checked) navigator.vibrate([35, 40, 35])
      else navigator.vibrate([80, 50, 80])
    }
  }, [valid, checked])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirming) closeRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirming])

  useEffect(() => {
    if (!checked) return
    const timer = window.setTimeout(() => closeRef.current(), 2800)
    return () => window.clearTimeout(timer)
  }, [checked])

  const price = Number(attendee?.unit_price ?? settings.price)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0611]/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => {
        if (!confirming) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={style.title}
        className="max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-[#fffdf9] shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`relative overflow-hidden bg-gradient-to-br px-6 pb-5 pt-5 text-white ${style.header}`}>
          <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-3 right-5 opacity-20">
            <Ghost className="size-16" />
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className={`grid size-12 place-items-center rounded-2xl ${style.iconBg}`}>
              <Icon className="size-6" />
            </div>
            <button
              onClick={onClose}
              disabled={confirming}
              aria-label="Cerrar resultado"
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 disabled:opacity-40"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="relative mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
            Resultado del escaneo
          </p>
          <h2 className="relative mt-1 text-2xl font-bold">{style.title}</h2>
          <p className="relative mt-1 text-sm text-white/80">{message || style.subtitle}</p>
          {checked && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div className="countdown-bar h-full bg-white/80" />
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-[#eee3d5] bg-[#faf6ef] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a808c]">Invitado</p>
            <p className="mt-0.5 break-words text-xl font-bold text-[#241f2b]">
              {attendee?.name || 'Código no registrado'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <p className="text-[11px] uppercase text-[#8a808c]">Código</p>
                <p className="font-bold text-[#5f2d83]">{attendee?.id || scanCode || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#8a808c]">Compra</p>
                <p className="break-all font-semibold">{attendee?.order_id || 'Individual'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#8a808c]">Precio</p>
                <p className="font-semibold">
                  {settings.currency} {price.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-[#8a808c]">Estado</p>
                <p className="font-semibold">{statusLabel(attendee)}</p>
              </div>
            </div>

            {attendee?.phone && (
              <p className="mt-3 text-sm text-[#756c78]">
                <span className="font-semibold text-[#241f2b]">Teléfono:</span> {attendee.phone}
              </p>
            )}

            {orderProgress && orderProgress.total > 1 && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5f2d83]">
                {orderProgress.used} de {orderProgress.total} entradas de esta compra ya ingresaron.
              </p>
            )}

            {result === 'used' && attendee?.used_at && (
              <p className="mt-2 text-xs text-[#8a808c]">Ingresó: {formatDateTime(attendee.used_at)}</p>
            )}

            {result === 'cancelled' && (
              <div className="mt-3 rounded-xl bg-[#fdecec] px-3 py-2 text-xs text-[#9b2c2c]">
                {attendee?.cancel_reason
                  ? `Motivo: ${attendee.cancel_reason}`
                  : `Cancelada: ${formatDateTime(attendee?.cancelled_at)}`}
              </div>
            )}
          </div>

          {valid && (
            <p className="mt-3 text-center text-xs text-[#8a808c]">
              Al aceptar, este QR queda inhabilitado para siempre.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {valid && (
              <button
                onClick={onConfirm}
                disabled={confirming}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2e8a54] px-4 py-3.5 font-bold text-white transition hover:bg-[#257446] disabled:opacity-60"
              >
                {confirming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {confirming ? 'Registrando ingreso...' : 'Aceptar ingreso'}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={confirming}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition disabled:opacity-60 ${
                checked
                  ? 'bg-[#2e8a54] text-white hover:bg-[#257446]'
                  : 'border border-[#ded7d1] bg-white text-[#241f2b] hover:bg-[#faf6ef]'
              }`}
            >
              {checked ? <Check className="size-4" /> : null}
              {checked ? 'Listo, siguiente' : 'Cerrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
