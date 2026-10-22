# Configuración de Supabase

## Paso 1: Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. Guarda la URL del proyecto y las keys

## Paso 2: Ejecutar el schema
1. Ve al SQL Editor en tu proyecto de Supabase
2. Copia y pega el contenido de `schema.sql`
3. Ejecuta el script

> Si ya tenías el proyecto creado con la versión anterior, vuelve a ejecutar
> `schema.sql`. Es idempotente y agrega las tablas `orders` y `event_settings`,
> el precio por entrada y la numeración segura de códigos `HP-0001`.

## Qué incluye ahora
- **Precio editable en caliente** en `event_settings` (no requiere redeploy).
- **Venta de varias entradas** a nombre de una misma persona (`orders`).
- **Un QR por entrada**, cada uno con su código único (`HP-0001`, `HP-0002`, ...).
- **PDF único** con todas las entradas de la compra, una por página.
- **Validez individual**: al confirmar el ingreso, solo esa entrada pasa a
  `used = true` y no puede volver a usarse. El update es atómico, así que dos
  escáneres simultáneos no pueden validar la misma entrada dos veces.

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
