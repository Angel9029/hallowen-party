import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const { data: attendee, error: fetchError } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .eq('id', code.trim().toUpperCase())
      .single()

    if (fetchError || !attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 })
    }

    if (!attendee.paid) {
      return NextResponse.json({ error: 'Not paid' }, { status: 400 })
    }

    if (attendee.used) {
      return NextResponse.json({ error: 'Already used' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('attendees')
      .update({ used: true })
      .eq('id', code.trim().toUpperCase())
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, attendee: data }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
