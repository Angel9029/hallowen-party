import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { normalizeAttendee, normalizeOrder } from '@/lib/event-settings'

export const dynamic = 'force-dynamic'

const MAX_REASON_LENGTH = 200

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = String(id || '').trim()

    if (!orderId) {
      return NextResponse.json({ error: 'La compra es obligatoria' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = String(body.reason ?? '').trim().slice(0, MAX_REASON_LENGTH) || null
    const force = body.force === true

    const { data: current, error: currentError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const { data: currentTickets, error: currentTicketsError } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('order_id', orderId)

    if (currentTicketsError) throw currentTicketsError

    if (current.cancelled_at) {
      return NextResponse.json({
        order: normalizeOrder(current),
        tickets: (currentTickets || []).map(normalizeAttendee),
        alreadyCancelled: true,
      })
    }

    const usedCount = (currentTickets || []).filter((ticket) => ticket.used).length

    if (usedCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `${usedCount} ${usedCount === 1 ? 'entrada ya fue utilizada' : 'entradas ya fueron utilizadas'}. Confirma que deseas cancelar la compra de todos modos.`,
          reason: 'has_used_tickets',
          used: usedCount,
        },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .update({ cancelled_at: now, cancel_reason: reason })
      .eq('id', orderId)
      .is('cancelled_at', null)
      .select()
      .maybeSingle()

    if (orderError) throw orderError

    // El trigger de la base de datos ya invalida las entradas. Este update
    // explícito mantiene la consistencia si el trigger aún no está instalado.
    const { error: ticketsError } = await supabaseAdmin
      .from('attendees')
      .update({ cancelled_at: now, cancel_reason: reason })
      .eq('order_id', orderId)
      .is('cancelled_at', null)

    if (ticketsError) throw ticketsError

    const { data: finalOrder, error: finalOrderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (finalOrderError) throw finalOrderError

    const { data: finalTickets, error: finalTicketsError } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    if (finalTicketsError) throw finalTicketsError

    return NextResponse.json({
      order: normalizeOrder(order || finalOrder),
      tickets: (finalTickets || []).map(normalizeAttendee),
    })
  } catch (error: any) {
    const message = error?.message || 'No se pudo cancelar la compra'
    const hint = /column|schema cache|relation|function/i.test(message)
      ? ' Ejecuta el schema.sql actualizado en Supabase.'
      : ''
    return NextResponse.json({ error: `${message}${hint}` }, { status: 500 })
  }
}
