import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import type { Attendee, EventSettings, Order } from './types'

export type PdfTicket = Pick<
  Attendee,
  | 'id'
  | 'name'
  | 'phone'
  | 'unit_price'
  | 'order_id'
  | 'paid'
  | 'used'
  | 'used_at'
  | 'cancelled_at'
  | 'cancel_reason'
>

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const PLUM: [number, number, number] = [36, 16, 47]
const PURPLE: [number, number, number] = [95, 45, 131]
const ORANGE: [number, number, number] = [240, 162, 58]
const CREAM: [number, number, number] = [247, 242, 234]
const MUTED: [number, number, number] = [138, 128, 140]
const RED: [number, number, number] = [190, 42, 42]
const GREEN: [number, number, number] = [46, 138, 84]
const AMBER: [number, number, number] = [166, 131, 0]

function money(settings: EventSettings, value: number) {
  return `${settings.currency} ${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${value}T12:00:00`))
  } catch {
    return value
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function drawMoon(doc: jsPDF, x: number, y: number, radius: number) {
  doc.setFillColor(250, 204, 92)
  doc.circle(x, y, radius, 'F')
  doc.setFillColor(...PLUM)
  doc.circle(x + radius * 0.52, y - radius * 0.24, radius * 0.86, 'F')
}

function drawPumpkin(doc: jsPDF, x: number, y: number, scale = 1) {
  doc.setFillColor(242, 140, 40)
  doc.ellipse(x, y, 6.4 * scale, 5.2 * scale, 'F')
  doc.ellipse(x - 4.6 * scale, y, 5 * scale, 4.6 * scale, 'F')
  doc.ellipse(x + 4.6 * scale, y, 5 * scale, 4.6 * scale, 'F')

  doc.setFillColor(86, 128, 54)
  doc.rect(x - 1 * scale, y - 7.2 * scale, 2 * scale, 3.4 * scale, 'F')

  doc.setFillColor(36, 16, 47)
  doc.triangle(
    x - 4.2 * scale,
    y - 1.6 * scale,
    x - 1.2 * scale,
    y - 1.6 * scale,
    x - 2.7 * scale,
    y + 0.9 * scale,
    'F'
  )
  doc.triangle(
    x + 1.2 * scale,
    y - 1.6 * scale,
    x + 4.2 * scale,
    y - 1.6 * scale,
    x + 2.7 * scale,
    y + 0.9 * scale,
    'F'
  )

  doc.setDrawColor(36, 16, 47)
  doc.setLineWidth(0.6 * scale)
  doc.line(x - 4.4 * scale, y + 2.2 * scale, x - 2.2 * scale, y + 3.2 * scale)
  doc.line(x - 2.2 * scale, y + 3.2 * scale, x, y + 2.2 * scale)
  doc.line(x, y + 2.2 * scale, x + 2.2 * scale, y + 3.2 * scale)
  doc.line(x + 2.2 * scale, y + 3.2 * scale, x + 4.4 * scale, y + 2.2 * scale)
}

function drawStars(doc: jsPDF) {
  doc.setFillColor(250, 204, 92)
  const stars: Array<[number, number, number]> = [
    [58, 26, 0.8],
    [72, 21, 0.55],
    [88, 28, 0.65],
    [130, 22, 0.6],
    [146, 28, 0.75],
  ]
  for (const [x, y, radius] of stars) {
    doc.circle(x, y, radius, 'F')
  }
}

function drawBat(doc: jsPDF, x: number, y: number, scale = 1) {
  doc.setFillColor(240, 162, 58)
  doc.triangle(
    x - 7 * scale,
    y,
    x - 2 * scale,
    y - 2.2 * scale,
    x - 3.4 * scale,
    y + 2.4 * scale,
    'F'
  )
  doc.triangle(
    x + 7 * scale,
    y,
    x + 2 * scale,
    y - 2.2 * scale,
    x + 3.4 * scale,
    y + 2.4 * scale,
    'F'
  )
  doc.circle(x, y, 1.5 * scale, 'F')
}

export async function buildTicketsPdf(
  tickets: PdfTicket[],
  settings: EventSettings,
  order?: Order | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const total = tickets.length

  for (let index = 0; index < total; index++) {
    if (index > 0) doc.addPage()

    const ticket = tickets[index]
    const price = Number(ticket.unit_price ?? order?.unit_price ?? settings.price)
    const cancelled = Boolean(ticket.cancelled_at || order?.cancelled_at)
    const used = Boolean(ticket.used)

    // Fondo
    doc.setFillColor(...CREAM)
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

    // Tarjeta
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...ORANGE)
    doc.setLineWidth(0.8)
    doc.roundedRect(14, 14, PAGE_WIDTH - 28, PAGE_HEIGHT - 28, 8, 8, 'FD')

    // Marca de agua diagonal para compras canceladas
    if (cancelled) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(54)
      doc.setTextColor(250, 213, 213)
      doc.text('CANCELADA', PAGE_WIDTH / 2, 168, { align: 'center', angle: 32 })
    }

    // Cabecera morada
    doc.setFillColor(...PLUM)
    doc.roundedRect(14, 14, PAGE_WIDTH - 28, 44, 8, 8, 'F')
    doc.rect(14, 46, PAGE_WIDTH - 28, 12, 'F')

    // Franja naranja superior
    doc.setFillColor(...ORANGE)
    doc.rect(14, 14, PAGE_WIDTH - 28, 3, 'F')

    drawStars(doc)
    drawPumpkin(doc, 31, 39, 1)
    drawMoon(doc, 180, 35, 7.5)
    drawBat(doc, 158, 25, 0.7)

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    let titleSize = 21
    doc.setFontSize(titleSize)
    while (titleSize > 11 && doc.getTextWidth(settings.event_name) > 122) {
      titleSize -= 1
      doc.setFontSize(titleSize)
    }
    doc.text(settings.event_name, PAGE_WIDTH / 2, 35, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(255, 214, 160)
    doc.text(`Noche de brujas · Entrada ${index + 1} de ${total}`, PAGE_WIDTH / 2, 44, {
      align: 'center',
    })

    // Nombre
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('A NOMBRE DE', PAGE_WIDTH / 2, 72, { align: 'center' })

    doc.setTextColor(36, 31, 43)
    doc.setFontSize(18)
    const splitName = doc.splitTextToSize(ticket.name, 160)
    const nameLines = splitName.slice(0, 3)
    if (splitName.length > 3 && nameLines.length === 3) {
      nameLines[2] = `${nameLines[2].slice(0, Math.max(0, nameLines[2].length - 3))}...`
    }
    doc.text(nameLines, PAGE_WIDTH / 2, 82, { align: 'center' })

    const nameOffset = Math.max(0, nameLines.length - 1) * 7
    const qrTop = 96 + nameOffset

    // QR vectorial: se dibuja modulo a modulo, sin incrustar imagenes.
    // Asi el PDF pesa unos pocos KB y el QR queda nitido en cualquier impresora.
    const qr = QRCode.create(ticket.id, { errorCorrectionLevel: 'M' })
    const modules = qr.modules
    const quietZone = 4
    const totalModules = modules.size + quietZone * 2
    const qrSize = 76
    const moduleSize = qrSize / totalModules
    const qrX = (PAGE_WIDTH - qrSize) / 2

    doc.setFillColor(255, 255, 255)
    doc.rect(qrX - 2, qrTop - 2, qrSize + 4, qrSize + 4, 'F')

    doc.setFillColor(36, 31, 43)
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) {
          doc.rect(
            qrX + (quietZone + col) * moduleSize,
            qrTop + (quietZone + row) * moduleSize,
            moduleSize,
            moduleSize,
            'F'
          )
        }
      }
    }

    // ID
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('CÓDIGO DE ENTRADA', PAGE_WIDTH / 2, qrTop + qrSize + 12, { align: 'center' })

    doc.setTextColor(...PURPLE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text(ticket.id, PAGE_WIDTH / 2, qrTop + qrSize + 23, { align: 'center' })

    // Separador
    const detailsTop = qrTop + qrSize + 36
    doc.setDrawColor(231, 224, 218)
    doc.setLineWidth(0.3)
    doc.line(30, detailsTop, PAGE_WIDTH - 30, detailsTop)

    // Datos
    doc.setTextColor(36, 31, 43)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    let y = detailsTop + 10

    doc.text(`Precio: ${money(settings, price)}`, PAGE_WIDTH / 2, y, { align: 'center' })
    y += 8

    if (ticket.phone) {
      doc.text(`Teléfono: ${ticket.phone}`, PAGE_WIDTH / 2, y, { align: 'center' })
      y += 8
    }

    if (ticket.order_id || order?.id) {
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.text(`Compra: ${ticket.order_id || order?.id}`, PAGE_WIDTH / 2, y, { align: 'center' })
    }

    // Pie de validez
    if (cancelled) {
      doc.setFillColor(253, 236, 236)
      doc.roundedRect(30, PAGE_HEIGHT - 41, PAGE_WIDTH - 60, 26, 4, 4, 'F')
      doc.setTextColor(...RED)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('COMPRA CANCELADA', PAGE_WIDTH / 2, PAGE_HEIGHT - 31, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text('No válida para ingresar', PAGE_WIDTH / 2, PAGE_HEIGHT - 25, {
        align: 'center',
      })
      const cancelDetail = ticket.cancel_reason
        ? `Motivo: ${ticket.cancel_reason}`
        : `Cancelada: ${formatDateTime(ticket.cancelled_at)}`
      doc.setFontSize(7.5)
      doc.text(cancelDetail, PAGE_WIDTH / 2, PAGE_HEIGHT - 19.5, { align: 'center' })
    } else {
      const tone = used ? AMBER : ticket.paid ? GREEN : AMBER
      doc.setFillColor(
        used ? 255 : ticket.paid ? 240 : 255,
        used ? 248 : ticket.paid ? 233 : 240,
        used ? 214 : ticket.paid ? 244 : 223
      )
      doc.roundedRect(30, PAGE_HEIGHT - 37, PAGE_WIDTH - 60, 22, 4, 4, 'F')
      doc.setTextColor(...tone)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(
        used
          ? 'ENTRADA YA UTILIZADA'
          : ticket.paid
            ? 'Válida para una sola persona'
            : 'Pendiente de pago',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 27,
        { align: 'center' }
      )
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text(
        used
          ? `Ingresó: ${formatDateTime(ticket.used_at)}`
          : ticket.paid
            ? 'Al escanearse por primera vez queda inhabilitada'
            : 'No es válida hasta confirmar el pago',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 21,
        { align: 'center' }
      )
    }

    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.text(
      `${settings.event_name} · ${formatDate(settings.event_date)} · Página ${index + 1} de ${total}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: 'center' }
    )
  }

  return doc
}

export async function downloadTicketsPdf(
  tickets: PdfTicket[],
  settings: EventSettings,
  order?: Order | null
) {
  const doc = await buildTicketsPdf(tickets, settings, order)
  const cancelled = tickets.some((ticket) => ticket.cancelled_at) || Boolean(order?.cancelled_at)
  const baseName = order?.id
    ? `entradas-${order.id}`
    : tickets.length === 1
      ? `entrada-${tickets[0].id}`
      : `entradas-${tickets[0]?.id || 'halloween'}`
  const fileName = `${baseName}${cancelled ? '-cancelada' : ''}.pdf`
  doc.save(fileName)
  return fileName
}

export async function shareTicketsPdf(
  tickets: PdfTicket[],
  settings: EventSettings,
  order?: Order | null
) {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return false

  const doc = await buildTicketsPdf(tickets, settings, order)
  const blob = doc.output('blob')
  const cancelled = tickets.some((ticket) => ticket.cancelled_at) || Boolean(order?.cancelled_at)
  const baseName = order?.id ? `entradas-${order.id}` : `entrada-${tickets[0]?.id || 'halloween'}`
  const fileName = `${baseName}${cancelled ? '-cancelada' : ''}.pdf`
  const file = new File([blob], fileName, { type: 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (nav.canShare && !nav.canShare({ files: [file] })) return false

  await navigator.share({
    files: [file],
    title: `${settings.event_name} · ${tickets.length} entrada${tickets.length === 1 ? '' : 's'}`,
    text: `Entradas de ${tickets[0]?.name || ''}${cancelled ? ' (canceladas)' : ''}`,
  })
  return true
}
