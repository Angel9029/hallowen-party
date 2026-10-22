import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  getEventSettings,
  nextTicketId,
  normalizeAttendee,
  normalizeOrder,
  roundMoney,
} from '@/lib/event-settings'

const MAX_TICKETS_PER_ORDER = 50

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const name = String(body.name ?? '').trim()
    const phone = body.phone ? String(body.phone).trim() : null
    const quantity = Number(body.quantity)
    const paid = body.paid === true
    const settings = await getEventSettings()

    const rawPrice = body.unit_price ?? body.unitPrice ?? settings.price
    const unitPrice = roundMoney(Number(rawPrice))

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
      return NextResponse.json(
        { error: `La cantidad debe ser un número entero entre 1 y ${MAX_TICKETS_PER_ORDER}` },
        { status: 400 }
      )
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: 'El precio debe ser mayor o igual a 0' }, { status: 400 })
    }

    const total = roundMoney(unitPrice * quantity)
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

    // La secuencia de Postgres garantiza IDs únicos aunque haya ventas simultáneas.
    const ticketIds = await Promise.all(
      Array.from({ length: quantity }, () => nextTicketId())
    )

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        buyer_name: name,
        phone,
        quantity,
        unit_price: unitPrice,
        total,
        paid,
      })
      .select()
      .single()

    if (orderError) throw orderError

    const now = new Date().toISOString()
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('attendees')
      .insert(
        ticketIds.map((id) => ({
          id,
          name,
          phone,
          paid,
          used: false,
          order_id: orderId,
          unit_price: unitPrice,
          paid_at: paid ? now : null,
        }))
      )
      .select()

    if (ticketsError) {
      // Si falla la creación de las entradas, no dejamos una orden huérfana.
      await supabaseAdmin.from('orders').delete().eq('id', orderId)
      throw ticketsError
    }

    const normalizedTickets = (tickets || [])
      .map(normalizeAttendee)
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json(
      { order: normalizeOrder(order), tickets: normalizedTickets },
      { status: 201 }
    )
  } catch (error: any) {
    const message = error?.message || 'No se pudo registrar la compra'
    const hint = /relation|column|function|schema cache/i.test(message)
      ? ' Parece que falta ejecutar el schema.sql actualizado en Supabase.'
      : ''
    return NextResponse.json({ error: `${message}${hint}` }, { status: 500 })
  }
}
