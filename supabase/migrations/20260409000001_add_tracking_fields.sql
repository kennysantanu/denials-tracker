-- Phase 1.9.1: Add tracking columns and updated_at triggers
-- Adds follow_up_date and updated_at to denials, updated_at to notes and patients.

ALTER TABLE denials ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE denials ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first for idempotency)
DROP TRIGGER IF EXISTS set_denials_updated_at ON denials;
CREATE TRIGGER set_denials_updated_at BEFORE UPDATE ON denials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_notes_updated_at ON notes;
CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_patients_updated_at ON patients;
CREATE TRIGGER set_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
