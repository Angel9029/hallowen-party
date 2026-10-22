export type Attendee = {
  id: string
  name: string
  phone: string | null
  paid: boolean
  used: boolean
  order_id?: string | null
  unit_price?: number
  paid_at?: string | null
  used_at?: string | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  created_at?: string
  updated_at?: string
}

export type EventSettings = {
  id: string
  event_name: string
  event_date: string
  price: number
  currency: string
  updated_at?: string
}

export type Order = {
  id: string
  buyer_name: string
  phone: string | null
  quantity: number
  unit_price: number
  total: number
  paid: boolean
  cancelled_at?: string | null
  cancel_reason?: string | null
  created_at?: string
}

export type View = 'inicio' | 'asistentes' | 'escanear'
export type Result = 'valid' | 'checked' | 'used' | 'cancelled' | 'invalid' | null
