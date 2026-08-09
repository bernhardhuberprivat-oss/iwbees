-- Erlaubt es, einen Ertragseintrag entweder als Gesamtmenge (hive = NULL, wie bisher)
-- oder als Menge für einen einzelnen Stock zu erfassen. So kann beim Schleudern wahlweise
-- nur die Gesamtmenge oder die Menge je Stock eingetragen werden.
ALTER TABLE harvest_entries ADD COLUMN IF NOT EXISTS hive INTEGER;

CREATE INDEX IF NOT EXISTS idx_harvest_entries_hive ON harvest_entries (user_id, hive);
