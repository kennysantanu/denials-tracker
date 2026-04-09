-- Add soft delete support for patients (HIPAA data retention)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for filtering active patients
CREATE INDEX IF NOT EXISTS idx_patients_is_active ON public.patients (is_active);
