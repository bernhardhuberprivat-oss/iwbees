CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  hive INTEGER NOT NULL CHECK (hive BETWEEN 1 AND 10),
  entry_date DATE NOT NULL,
  notes TEXT,
  weather TEXT,
  colony_strength TEXT,
  varroa TEXT,
  feeding TEXT,
  honey_harvest_kg NUMERIC,
  photo_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_hive ON entries (hive);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries (entry_date DESC);
