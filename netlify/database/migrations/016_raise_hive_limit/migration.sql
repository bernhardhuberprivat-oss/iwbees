-- Die Anzahl der Bienenstöcke ist jetzt pro Nutzer einstellbar (statt fix auf 10),
-- daher die alten CHECK-Constraints lockern, damit auch höhere Stocknummern erlaubt sind.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entries_hive_check') THEN
    ALTER TABLE entries DROP CONSTRAINT entries_hive_check;
  END IF;
END $$;
ALTER TABLE entries ADD CONSTRAINT entries_hive_check CHECK (hive BETWEEN 1 AND 60);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hive_colors_hive_check') THEN
    ALTER TABLE hive_colors DROP CONSTRAINT hive_colors_hive_check;
  END IF;
END $$;
ALTER TABLE hive_colors ADD CONSTRAINT hive_colors_hive_check CHECK (hive BETWEEN 1 AND 60);
