import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getEventSettings, normalizeSettings, roundMoney } from '@/lib/event-settings'

export async function GET() {
  try {
    const settings = await getEventSettings()
    return NextResponse.json({ settings })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const price = Number(body.price)

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'El precio debe ser un número mayor o igual a 0' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { price: roundMoney(price) }

    if (typeof body.event_name === 'string' && body.event_name.trim()) {
      updates.event_name = body.event_name.trim()
    }
    if (typeof body.currency === 'string' && body.currency.trim()) {
      updates.currency = body.currency.trim()
    }
    if (typeof body.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_date)) {
      updates.event_date = body.event_date
    }

    const { data, error } = await supabaseAdmin
      .from('event_settings')
      .upsert({ id: 'default', ...updates })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ settings: normalizeSettings(data) })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'No se pudo actualizar la configuración' },
      { status: 500 }
    )
  }
}
