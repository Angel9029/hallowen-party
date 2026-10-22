import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  getEventSettings,
  nextTicketId,
  normalizeAttendee,
  roundMoney,
} from '@/lib/event-settings'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error
    return NextResponse.json({ attendees: (data || []).map(normalizeAttendee) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Registro de una sola entrada. El flujo de venta múltiple usa /api/purchases.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, paid } = body
    const settings = await getEventSettings()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const unitPrice = roundMoney(Number(body.unit_price ?? body.unitPrice ?? settings.price))
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: 'El precio debe ser mayor o igual a 0' }, { status: 400 })
    }

    const isPaid = paid === true || paid === 'si'
    const id = await nextTicketId()

    const { data, error } = await supabaseAdmin
      .from('attendees')
      .insert({
        id,
        name: name.trim(),
        phone: phone?.trim() || null,
        paid: isPaid,
        used: false,
        order_id: null,
        unit_price: unitPrice,
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ attendee: normalizeAttendee(data) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'No se pudo registrar la entrada' },
      { status: 500 }
    )
  }
}
