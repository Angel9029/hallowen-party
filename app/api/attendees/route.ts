import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('attendees')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ attendees: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, paid } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate ID
    const { data: existing } = await supabaseAdmin
      .from('attendees')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)

    const count = existing && existing.length > 0 ? parseInt(existing[0].id.split('-')[1]) + 1 : 1
    const id = `HP-${String(count).padStart(3, '0')}`

    const { data, error } = await supabaseAdmin
      .from('attendees')
      .insert({
        id,
        name: name.trim(),
        phone: phone?.trim() || null,
        paid: paid === true || paid === 'si',
        used: false,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ attendee: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
