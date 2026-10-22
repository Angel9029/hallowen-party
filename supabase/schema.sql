-- Halloween Party - Supabase Schema
-- Ejecuta este script en el SQL Editor de Supabase.
-- Es idempotente: puedes volver a ejecutarlo sin perder datos.

-- =========================================================
-- 1. Entradas (una fila = una entrada con su propio QR)
-- =========================================================
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  paid BOOLEAN DEFAULT FALSE,
  used BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas nuevas para ventas por lote y precio historico por entrada
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- =========================================================
-- 2. Compras (agrupa varias entradas de una misma persona)
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  buyer_name TEXT NOT NULL,
  phone TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas para compras existentes creadas con la version anterior
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- =========================================================
-- 3. Configuracion del evento (precio editable en caliente)
-- =========================================================
CREATE TABLE IF NOT EXISTS event_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  event_name TEXT NOT NULL DEFAULT 'Halloween Party',
  event_date DATE NOT NULL DEFAULT '2026-10-31',
  price NUMERIC(10, 2) NOT NULL DEFAULT 5.00 CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'S/',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO event_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Las entradas antiguas no tenían precio por fila. Si quieres que aparezcan
-- con el precio actual, ejecuta una vez esta linea (descomentándola):
-- UPDATE attendees SET unit_price = (SELECT price FROM event_settings WHERE id = 'default')
--  WHERE unit_price = 0 AND order_id IS NULL;

-- =========================================================
-- 4. Indices
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_attendees_name ON attendees(name);
CREATE INDEX IF NOT EXISTS idx_attendees_paid ON attendees(paid);
CREATE INDEX IF NOT EXISTS idx_attendees_used ON attendees(used);
CREATE INDEX IF NOT EXISTS idx_attendees_order_id ON attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_attendees_cancelled_at ON attendees(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at);

-- =========================================================
-- 5. IDs unicos y secuenciales para las entradas (HP-0001)
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1;

-- Continua la numeracion despues de las entradas que ya existan.
DO $$
DECLARE
  max_num BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(id, '\D', '', 'g'))::BIGINT), 0)
    INTO max_num
    FROM attendees
   WHERE id ~ '^HP-[0-9]+$';

  PERFORM setval('ticket_number_seq', GREATEST(max_num, 1), max_num > 0);
END $$;

CREATE OR REPLACE FUNCTION next_ticket_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := 'HP-' || LPAD(nextval('ticket_number_seq')::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM attendees WHERE id = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- =========================================================
-- 6. updated_at automatico
-- =========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_attendees_updated_at ON attendees;
CREATE TRIGGER update_attendees_updated_at
  BEFORE UPDATE ON attendees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_settings_updated_at ON event_settings;
CREATE TRIGGER update_event_settings_updated_at
  BEFORE UPDATE ON event_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 7. Cancelacion en cascada de una compra
-- =========================================================
-- Al cancelar una orden, todas sus entradas quedan invalidadas en la misma
-- transaccion. Funciona tambien si la cancelacion se hace desde el dashboard
-- de Supabase, no solo desde la app.
CREATE OR REPLACE FUNCTION sync_order_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
    UPDATE attendees
       SET cancelled_at = NEW.cancelled_at,
           cancel_reason = NEW.cancel_reason,
           updated_at = NOW()
     WHERE order_id = NEW.id
       AND (cancelled_at IS DISTINCT FROM NEW.cancelled_at
            OR cancel_reason IS DISTINCT FROM NEW.cancel_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS sync_order_cancellation_trigger ON orders;
CREATE TRIGGER sync_order_cancellation_trigger
  AFTER UPDATE OF cancelled_at, cancel_reason ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_cancellation();

-- Edita nombre/telefono del comprador y sincroniza todas sus entradas en una
-- sola transaccion. El monto y la cantidad no se tocan.
CREATE OR REPLACE FUNCTION update_order_buyer(
  p_order_id TEXT,
  p_name TEXT,
  p_phone TEXT
)
RETURNS orders
LANGUAGE plpgsql
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
     SET buyer_name = p_name,
         phone = p_phone
   WHERE id = p_order_id
     AND cancelled_at IS NULL
   RETURNING * INTO updated_order;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe o esta cancelada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE attendees
     SET name = p_name,
         phone = p_phone
   WHERE order_id = p_order_id
     AND cancelled_at IS NULL;

  RETURN updated_order;
END;
$$;

-- =========================================================
-- 8. Row Level Security
-- =========================================================
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

-- attendees: lectura anonima para validacion, escritura solo service role
DROP POLICY IF EXISTS "Allow anonymous read access" ON attendees;
CREATE POLICY "Allow anonymous read access" ON attendees
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON attendees;
CREATE POLICY "Allow service role full access" ON attendees
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- orders: solo service role
DROP POLICY IF EXISTS "Allow service role full access" ON orders;
CREATE POLICY "Allow service role full access" ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- event_settings: lectura publica del precio, escritura service role
DROP POLICY IF EXISTS "Allow anonymous read access" ON event_settings;
CREATE POLICY "Allow anonymous read access" ON event_settings
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON event_settings;
CREATE POLICY "Allow service role full access" ON event_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- 9. Recargar la cache de PostgREST
-- =========================================================
-- Necesario para que la API vea de inmediato las tablas nuevas o cambiadas.
NOTIFY pgrst, 'reload schema';
