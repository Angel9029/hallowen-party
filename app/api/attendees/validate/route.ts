import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { normalizeAttendee } from '@/lib/event-settings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body.code ?? '').trim().toUpperCase()

    if (!code) {
      return NextResponse.json({ valid: false, reason: 'missing_code' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('id', code)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 200 })
    }

    const attendee = normalizeAttendee(data)

    if (attendee.cancelled_at) {
      return NextResponse.json(
        { valid: false, reason: 'cancelled', attendee, message: 'Esta compra fue cancelada.' },
        { status: 200 }
      )
    }

    if (!attendee.paid) {
      return NextResponse.json({ valid: false, reason: 'not_paid', attendee }, { status: 200 })
    }

    if (attendee.used) {
      return NextResponse.json({ valid: false, reason: 'already_used', attendee }, { status: 200 })
    }

    return NextResponse.json({ valid: true, attendee }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
  }
}
