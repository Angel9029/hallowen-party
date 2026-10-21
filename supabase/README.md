# Configuración de Supabase

## Paso 1: Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Guarda la URL del proyecto y las keys

## Paso 2: Ejecutar el schema
1. Ve al SQL Editor en tu proyecto de Supabase
2. Copia y pega el contenido de `schema.sql`
3. Ejecuta el script

## Paso 3: Configurar variables de entorno
1. Copia `.env.example` a `.env.local`
2. Completa con tus credenciales de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL` - URL de tu proyecto
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (público)
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (secreto, solo server-side)

## Paso 4: Desplegar

### En Cloudflare Pages
1. Conecta tu repositorio
2. Build command: `pnpm build` o `npm run build`
3. Build output: `.next`
4. Añade las variables de entorno en Cloudflare Pages settings

### En Supabase
El schema ya está listo. Las APIs usan el service role key para operaciones de escritura.
