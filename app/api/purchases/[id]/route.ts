import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { normalizeAttendee, normalizeOrder } from '@/lib/event-settings'

export const dynamic = 'force-dynamic'

const MAX_NAME_LENGTH = 120
const MAX_PHONE_LENGTH = 40

export async function PATCH(
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
    const action = body.action as string | undefined

    const { data: current, error: currentError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }
    if (current.cancelled_at) {
      return NextResponse.json(
        { error: 'No se puede editar una compra cancelada' },
        { status: 409 }
      )
    }

    if (action === 'mark_paid_pending' || action === 'mark_paid_all') {
      const now = new Date().toISOString()
      let query = supabaseAdmin
        .from('attendees')
        .update({ paid: true, paid_at: now })
        .eq('order_id', orderId)
        .is('cancelled_at', null)

      if (action === 'mark_paid_pending') {
        query = query.eq('paid', false)
      }

      const { error: payError } = await query
      if (payError) throw payError

      const { data: allTickets, error: allTicketsError } = await supabaseAdmin
        .from('attendees')
        .select('*')
        .eq('order_id', orderId)

      if (allTicketsError) throw allTicketsError

      const tickets = allTickets || []
      const activeTickets = tickets.filter((t) => !t.cancelled_at)
      const allActivePaid = activeTickets.length > 0 && activeTickets.every((t) => t.paid)

      if (allActivePaid && !current.paid) {
        const { error: orderPayError } = await supabaseAdmin
          .from('orders')
          .update({ paid: true })
          .eq('id', orderId)
        if (orderPayError) throw orderPayError
      } else if (!allActivePaid && current.paid) {
        const { error: orderPayError } = await supabaseAdmin
          .from('orders')
          .update({ paid: false })
          .eq('id', orderId)
        if (orderPayError) throw orderPayError
      }

      const { data: order, error: orderReloadError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      if (orderReloadError) throw orderReloadError

      const { data: finalTickets, error: finalTicketsError } = await supabaseAdmin
        .from('attendees')
        .select('*')
        .eq('order_id', orderId)
        .order('id', { ascending: true })
      if (finalTicketsError) throw finalTicketsError

      return NextResponse.json({
        order: normalizeOrder(order),
        tickets: (finalTickets || []).map(normalizeAttendee),
      })
    }

    if (action === 'mark_ticket_paid') {
      const ticketId = String(body.ticketId || '').trim().toUpperCase()
      if (!ticketId) {
        return NextResponse.json({ error: 'Código de entrada inválido' }, { status: 400 })
      }
      const now = new Date().toISOString()
      const { data: ticket, error: ticketFindError } = await supabaseAdmin
        .from('attendees')
        .select('*')
        .eq('id', ticketId)
        .eq('order_id', orderId)
        .maybeSingle()
      if (ticketFindError) throw ticketFindError
      if (!ticket) {
        return NextResponse.json({ error: 'Entrada no encontrada en esta compra' }, { status: 404 })
      }
      if (ticket.cancelled_at) {
        return NextResponse.json({ error: 'No se puede marcar como pagada una entrada cancelada' }, { status: 409 })
      }

      const { error: ticketPayError } = await supabaseAdmin
        .from('attendees')
        .update({ paid: true, paid_at: now })
        .eq('id', ticketId)
      if (ticketPayError) throw ticketPayError

      const { data: allTickets, error: allTicketsError } = await supabaseAdmin
        .from('attendees')
        .select('*')
        .eq('order_id', orderId)
      if (allTicketsError) throw allTicketsError

      const tickets = allTickets || []
      const activeTickets = tickets.filter((t) => !t.cancelled_at)
      const allActivePaid = activeTickets.length > 0 && activeTickets.every((t) => t.paid)

      if (allActivePaid && !current.paid) {
        await supabaseAdmin.from('orders').update({ paid: true }).eq('id', orderId)
      } else if (!allActivePaid && current.paid) {
        await supabaseAdmin.from('orders').update({ paid: false }).eq('id', orderId)
      }

      const { data: order, error: orderReloadError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      if (orderReloadError) throw orderReloadError

      const { data: finalTickets, error: finalTicketsError } = await supabaseAdmin
        .from('attendees')
        .select('*')
        .eq('order_id', orderId)
        .order('id', { ascending: true })
      if (finalTicketsError) throw finalTicketsError

      return NextResponse.json({
        order: normalizeOrder(order),
        tickets: (finalTickets || []).map(normalizeAttendee),
      })
    }

    const name = String(body.name ?? '').trim()
    const rawPhone = body.phone == null ? '' : String(body.phone).trim()
    const phone = rawPhone || null

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres` },
        { status: 400 }
      )
    }
    if (phone && phone.length > MAX_PHONE_LENGTH) {
      return NextResponse.json(
        { error: `El teléfono no puede superar ${MAX_PHONE_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin.rpc('update_order_buyer', {
      p_order_id: orderId,
      p_name: name,
      p_phone: phone,
    })

    if (orderError) {
      if (orderError.code === 'P0002') {
        return NextResponse.json(
          { error: 'La compra ya no está disponible para editar' },
          { status: 409 }
        )
      }
      throw orderError
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    if (ticketsError) throw ticketsError

    return NextResponse.json({
      order: normalizeOrder(order),
      tickets: (tickets || []).map(normalizeAttendee),
    })
  } catch (error: any) {
    const message = error?.message || 'No se pudo actualizar la compra'
    const hint = /function|column|schema cache|relation/i.test(message)
      ? ' Ejecuta el schema.sql actualizado en Supabase.'
      : ''
    return NextResponse.json({ error: `${message}${hint}` }, { status: 500 })
  }
}
