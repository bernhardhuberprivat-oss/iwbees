-- Sprachnotizen: kurze Audioaufnahmen, unabhaengig von einem Tagebucheintrag (z. B.
-- freihaendig am Bienenstock mit Handschuhen aufgenommen), optional einem Stock
-- zugeordnet. "hive" ist bewusst nullable (keine Zuordnung noetig) und referenziert
-- keine eigene Stock-Tabelle (die App verwaltet Stocknummern 1..hiveCount nur als
-- Zahl, siehe entries.hive/hive_colors.hive - selbe Konvention hier uebernommen).
CREATE TABLE IF NOT EXISTS voice_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  hive INTEGER CHECK (hive IS NULL OR hive BETWEEN 1 AND 60),
  duration_seconds NUMERIC,
  audio_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_user ON voice_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_date ON voice_notes (created_at DESC);
