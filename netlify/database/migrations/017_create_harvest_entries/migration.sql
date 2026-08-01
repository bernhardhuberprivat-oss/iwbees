CREATE TABLE IF NOT EXISTS harvest_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  entry_date DATE NOT NULL,
  kg NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvest_entries_user ON harvest_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_harvest_entries_date ON harvest_entries (entry_date DESC);

-- Bisherige jährliche Gesamterträge als einzelne Einträge übernehmen (Datum: 31. Dezember
-- des jeweiligen Jahres), damit beim Umstieg auf datierte Einzeleinträge keine Altdaten verloren gehen.
INSERT INTO harvest_entries (user_id, entry_date, kg)
SELECT user_id, make_date(year, 12, 31), kg
FROM annual_harvest
WHERE kg IS NOT NULL;
