import { supabaseAdmin } from './supabase-server'
import type { Attendee, EventSettings, Order } from './types'

export const DEFAULT_SETTINGS: EventSettings = {
  id: 'default',
  event_name: 'Halloween Party',
  event_date: '2026-10-31',
  price: 5,
  currency: 'S/',
}

export function normalizeSettings(row: any): EventSettings {
  return {
    id: 'default',
    event_name: row?.event_name || DEFAULT_SETTINGS.event_name,
    event_date: row?.event_date || DEFAULT_SETTINGS.event_date,
    price: Number(row?.price ?? DEFAULT_SETTINGS.price),
    currency: row?.currency || DEFAULT_SETTINGS.currency,
    updated_at: row?.updated_at,
  }
}

export function normalizeAttendee(row: any): Attendee {
  return {
    ...row,
    paid: Boolean(row?.paid),
    used: Boolean(row?.used),
    unit_price: Number(row?.unit_price ?? 0),
  }
}

export function normalizeOrder(row: any): Order {
  // PostgREST puede devolver un objeto o un arreglo de un elemento según la
  // firma de la función RPC; normalizamos ambos casos.
  const value = Array.isArray(row) ? row[0] : row
  return {
    ...value,
    paid: Boolean(value?.paid),
    quantity: Number(value?.quantity ?? 0),
    unit_price: Number(value?.unit_price ?? 0),
    total: Number(value?.total ?? 0),
    cancelled_at: value?.cancelled_at ?? null,
    cancel_reason: value?.cancel_reason ?? null,
  }
}

export async function getEventSettings(): Promise<EventSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('event_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (error || !data) return DEFAULT_SETTINGS
    return normalizeSettings(data)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function nextTicketId(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('next_ticket_id')
  if (error || !data) {
    throw new Error(
      'No se pudo generar el ID de la entrada. Ejecuta el schema.sql actualizado en Supabase.'
    )
  }
  return String(data)
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
