import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import type { Attendee, EventSettings, Order } from './types'

export type PdfTicket = Pick<Attendee, 'id' | 'name' | 'phone' | 'unit_price' | 'order_id' | 'paid'>

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297

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

    // Fondo
    doc.setFillColor(247, 245, 242)
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')

    // Tarjeta
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(231, 224, 218)
    doc.setLineWidth(0.4)
    doc.roundedRect(14, 14, PAGE_WIDTH - 28, PAGE_HEIGHT - 28, 8, 8, 'FD')

    // Cabecera morada
    doc.setFillColor(95, 45, 131)
    doc.roundedRect(14, 14, PAGE_WIDTH - 28, 42, 8, 8, 'F')
    doc.rect(14, 46, PAGE_WIDTH - 28, 10, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(settings.event_name, PAGE_WIDTH / 2, 32, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(`Entrada ${index + 1} de ${total}`, PAGE_WIDTH / 2, 42, { align: 'center' })

    // Nombre
    doc.setTextColor(138, 128, 140)
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
    const qrSize = 78
    const moduleSize = qrSize / totalModules
    const qrX = (PAGE_WIDTH - qrSize) / 2

    doc.setFillColor(255, 255, 255)
    doc.rect(qrX, qrTop, qrSize, qrSize, 'F')

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
    doc.setTextColor(138, 128, 140)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('CÓDIGO DE ENTRADA', PAGE_WIDTH / 2, qrTop + qrSize + 12, { align: 'center' })

    doc.setTextColor(95, 45, 131)
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
      doc.setTextColor(138, 128, 140)
      doc.text(`Compra: ${ticket.order_id || order?.id}`, PAGE_WIDTH / 2, y, { align: 'center' })
      y += 8
    }

    // Pie de validez
    doc.setFillColor(ticket.paid ? 240 : 255, ticket.paid ? 233 : 240, ticket.paid ? 244 : 223)
    doc.roundedRect(30, PAGE_HEIGHT - 37, PAGE_WIDTH - 60, 22, 4, 4, 'F')
    doc.setTextColor(ticket.paid ? 95 : 163, ticket.paid ? 45 : 92, ticket.paid ? 131 : 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(ticket.paid ? 'Válida para una sola persona' : 'Pendiente de pago', PAGE_WIDTH / 2, PAGE_HEIGHT - 27, {
      align: 'center',
    })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(
      ticket.paid
        ? 'Al escanearse por primera vez queda inhabilitada'
        : 'No es válida hasta confirmar el pago',
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 21,
      { align: 'center' }
    )

    doc.setTextColor(138, 128, 140)
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
  const fileName = order?.id
    ? `entradas-${order.id}.pdf`
    : tickets.length === 1
      ? `entrada-${tickets[0].id}.pdf`
      : `entradas-${tickets[0]?.id || 'halloween'}.pdf`
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
  const fileName = order?.id
    ? `entradas-${order.id}.pdf`
    : `entrada-${tickets[0]?.id || 'halloween'}.pdf`
  const file = new File([blob], fileName, { type: 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (nav.canShare && !nav.canShare({ files: [file] })) return false

  await navigator.share({
    files: [file],
    title: `${settings.event_name} · ${tickets.length} entrada${tickets.length === 1 ? '' : 's'}`,
    text: `Entradas de ${tickets[0]?.name || ''}`,
  })
  return true
}
