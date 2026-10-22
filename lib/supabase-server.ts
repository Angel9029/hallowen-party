import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!cachedClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Faltan las variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Revisa tu .env.local.'
      )
    }

    cachedClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return cachedClient
}

// Proxy para no crear el cliente al importar el módulo (por ejemplo, durante
// `next build` sin variables de entorno). El cliente real se crea en la
// primera operación de cada request.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseAdmin() as unknown as Record<string | symbol, unknown>
    const value = client[property]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
