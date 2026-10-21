import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || !code.trim()) {
      return NextResponse.json({ valid: false, error: 'Code is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('id', code.trim().toUpperCase())
      .single()

    if (error || !data) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    if (!data.paid) {
      return NextResponse.json({ valid: false, reason: 'not_paid', attendee: data }, { status: 200 })
    }

    if (data.used) {
      return NextResponse.json({ valid: false, reason: 'already_used', attendee: data }, { status: 200 })
    }

    return NextResponse.json({ valid: true, attendee: data }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 })
  }
}
