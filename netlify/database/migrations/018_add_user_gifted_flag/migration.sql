-- Erlaubt es einem Admin (siehe netlify/functions/admin.mts), einzelnen Nutzer:innen
-- die Bezahlschranke der nativen iOS-App dauerhaft zu erlassen ("Abo verschenken"),
-- unabhängig von einem echten RevenueCat-Abo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_gifted BOOLEAN NOT NULL DEFAULT false;
