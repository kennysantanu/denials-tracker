-- Attachments require this bucket on fresh installs as well as upgrades.
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO UPDATE SET public = false;
