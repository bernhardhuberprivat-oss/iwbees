// Stellt sicher, dass die für das Web-Abo (Stripe) benötigten Spalten auf der
// "users"-Tabelle existieren - läuft "selbstmigrierend" beim ersten Request nach dem
// Deploy, damit kein manueller Migrations-Schritt nötig ist (ADD COLUMN IF NOT EXISTS
// ist in Postgres eine günstige, idempotente Metadaten-Operation, auch wenn sie bei
// jedem Aufruf erneut ausgeführt wird).
//
// - web_trial_start: eigener Anker für die 30-Tage-Testphase im WEB-Build, getrennt
//   von created_at (das weiterhin nur für die native iOS-App gilt). Für neue Konten
//   wird sie direkt bei der Registrierung gesetzt; für bestehende Konten trägt
//   users-login.mts sie beim ersten Login nach dem Rollout nach (COALESCE-Backfill).
// - stripe_customer_id / stripe_subscription_status: Web-Pendant zu RevenueCat, siehe
//   netlify/functions/stripe-webhook.mts.
import { getDatabase } from "@netlify/database";

export async function ensureSubscriptionColumns(db: ReturnType<typeof getDatabase>) {
  await db.sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS web_trial_start TIMESTAMPTZ`;
  await db.sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await db.sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT`;
}

// Stripe-Subscription-Status-Werte, die als "aktives Abo" gelten (siehe
// https://docs.stripe.com/api/subscriptions/object#subscription_object-status).
// "trialing" ist hier nur der Vollständigkeit halber gelistet - wir vergeben aktuell
// keine Stripe-eigenen Trials, da die App ihre eigene 30-Tage-Logik hat.
export function isStripeStatusActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
