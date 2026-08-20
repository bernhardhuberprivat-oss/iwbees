import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { ensureSubscriptionColumns } from "./_subscriptionSchema.mts";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  return new Stripe(key);
}

// Empfängt Stripes Webhook-Events und hält stripe_customer_id/stripe_subscription_status
// in der DB aktuell - das ist die einzige Quelle, aus der checkSubscription() im
// Web-Build (src/subscription.ts) den Abo-Status liest. Bewusst OHNE withCors: dieser
// Endpunkt wird ausschließlich von Stripes Servern aufgerufen (nie vom eigenen
// Frontend), die Signaturprüfung unten übernimmt die Absicherung, keine CORS-Header
// nötig - und withCors würde hier nur unnötige Komplexität in den Rohtext-Body bringen.
const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    console.warn("Stripe-Webhook: STRIPE_WEBHOOK_SECRET fehlt oder keine Signatur im Request");
    return new Response("Webhook nicht konfiguriert", { status: 500 });
  }

  // Für die Signaturprüfung wird der unveränderte Rohtext gebraucht, nicht das
  // geparste JSON - deshalb hier bewusst req.text() statt req.json().
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn("Stripe-Webhook: ungültige Signatur", err);
    return new Response("Ungültige Signatur", { status: 400 });
  }

  const db = getDatabase();
  await ensureSubscriptionColumns(db);

  async function setStatusByCustomer(customerId: string, status: string) {
    await db.sql`UPDATE users SET stripe_subscription_status = ${status} WHERE stripe_customer_id = ${customerId}`;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.metadata?.userId ?? session.client_reference_id);
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId && customerId) {
          await db.sql`
            UPDATE users
            SET stripe_customer_id = ${customerId}, stripe_subscription_status = 'active'
            WHERE id = ${userId}
          `;
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // sub.status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | ...
        await setStatusByCustomer(customerId, sub.status);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await setStatusByCustomer(customerId, "canceled");
        break;
      }
      default:
        // Andere Event-Typen (z. B. invoice.*) sind für unsere einfache
        // Aktiv/Nicht-aktiv-Logik nicht relevant und werden ignoriert.
        break;
    }
  } catch (err) {
    console.warn("Stripe-Webhook: Verarbeitung fehlgeschlagen:", err);
    // Trotzdem 200 zurückgeben würde Stripe-Retries verhindern, die hier eigentlich
    // erwünscht sind (z. B. bei kurzzeitigen DB-Problemen) - deshalb 500, damit
    // Stripe das Event automatisch erneut zustellt.
    return new Response("Verarbeitung fehlgeschlagen", { status: 500 });
  }

  return new Response(null, { status: 200 });
};

export const config: Config = {
  path: "/api/stripe-webhook",
};

export default handler;
