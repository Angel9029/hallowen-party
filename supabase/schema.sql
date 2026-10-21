-- Halloween Party - Supabase Schema
-- Execute this in your Supabase SQL Editor

-- Create attendees table
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  paid BOOLEAN DEFAULT FALSE,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_attendees_name ON attendees(name);
CREATE INDEX IF NOT EXISTS idx_attendees_paid ON attendees(paid);
CREATE INDEX IF NOT EXISTS idx_attendees_used ON attendees(used);

-- Enable Row Level Security
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous users to read (for QR validation)
CREATE POLICY "Allow anonymous read access" ON attendees
  FOR SELECT
  TO anon
  USING (true);

-- Policy for authenticated/service role to insert
CREATE POLICY "Allow service role full access" ON attendees
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_attendees_updated_at BEFORE UPDATE ON attendees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
