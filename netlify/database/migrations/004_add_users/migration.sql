CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bereits vorhandene Einträge/Farben aus der Zeit vor der Mehrnutzer-Unterstützung
-- einem Standard-Nutzer zuordnen, damit keine Daten verloren gehen.
-- Name: "Mein Tagebuch", PIN: 0000 (kann danach in der App geändert werden)
INSERT INTO users (name, pin_hash)
SELECT 'Mein Tagebuch', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0'
WHERE (EXISTS (SELECT 1 FROM entries) OR EXISTS (SELECT 1 FROM hive_colors))
  AND NOT EXISTS (SELECT 1 FROM users);

ALTER TABLE entries ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
UPDATE entries SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL;

ALTER TABLE hive_colors ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
UPDATE hive_colors SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hive_colors_pkey') THEN
    ALTER TABLE hive_colors DROP CONSTRAINT hive_colors_pkey;
  END IF;
END $$;

ALTER TABLE hive_colors ADD PRIMARY KEY (user_id, hive);

CREATE INDEX IF NOT EXISTS idx_entries_user ON entries (user_id);
