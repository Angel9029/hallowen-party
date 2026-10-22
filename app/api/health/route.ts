import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const TABLES = ['attendees', 'orders', 'event_settings'] as const

function projectHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname
  } catch {
    return ''
  }
}

export async function GET() {
  const host = projectHost()
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!hasUrl || !hasServiceKey) {
    return NextResponse.json(
      {
        ok: false,
        project: host || null,
        env: { url: hasUrl, anonKey: hasAnonKey, serviceRoleKey: hasServiceKey },
        error:
          'Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno de Vercel. Añádelas y vuelve a desplegar.',
      },
      { status: 500 }
    )
  }

  const tables: Record<string, { ok: boolean; count?: number; error?: string }> = {}

  for (const table of TABLES) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })

    tables[table] = error ? { ok: false, error: error.message } : { ok: true, count: count ?? 0 }
  }

  const missing = Object.entries(tables)
    .filter(([, value]) => !value.ok)
    .map(([table]) => table)
  const ok = missing.length === 0

  return NextResponse.json(
    {
      ok,
      project: host,
      env: { url: hasUrl, anonKey: hasAnonKey, serviceRoleKey: hasServiceKey },
      tables,
      hint: ok
        ? null
        : `El proyecto "${host}" no tiene las tablas: ${missing.join(', ')}. Abre ESE proyecto en supabase.com, ejecuta supabase/schema.sql en el SQL Editor y luego ejecuta: NOTIFY pgrst, 'reload schema';`,
    },
    { status: ok ? 200 : 503 }
  )
}
