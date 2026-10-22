import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { normalizeAttendee } from '@/lib/event-settings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body.code ?? '').trim().toUpperCase()

    if (!code) {
      return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Update condicional y atómico: solo la primera lectura de un QR puede
    // pasar de used=false a used=true. Si dos escáneres llegan a la vez,
    // únicamente uno recibe la fila y el otro obtiene "already_used".
    const { data, error } = await supabaseAdmin
      .from('attendees')
      .update({ used: true, used_at: now })
      .eq('id', code)
      .eq('used', false)
      .eq('paid', true)
      .select()
      .maybeSingle()

    if (error) throw error

    if (data) {
      return NextResponse.json(
        { success: true, attendee: normalizeAttendee(data) },
        { status: 200 }
      )
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('id', code)
      .maybeSingle()

    if (existingError) throw existingError

    if (!existing) {
      return NextResponse.json(
        { error: 'Entrada no encontrada', reason: 'not_found' },
        { status: 404 }
      )
    }

    const attendee = normalizeAttendee(existing)

    if (attendee.used) {
      return NextResponse.json(
        { error: 'Esta entrada ya fue utilizada', reason: 'already_used', attendee },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'La entrada no está pagada', reason: 'not_paid', attendee },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'No se pudo registrar el ingreso' },
      { status: 500 }
    )
  }
}
