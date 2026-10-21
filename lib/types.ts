export type Attendee = {
  id: string
  name: string
  phone: string | null
  paid: boolean
  used: boolean
  created_at?: string
  updated_at?: string
}

export type View = 'inicio' | 'asistentes' | 'escanear'
export type Result = 'valid' | 'used' | 'invalid' | null
