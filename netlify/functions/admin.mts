import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { ensureSubscriptionColumns } from "./_subscriptionSchema.mts";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

function getPhotoStore() {
  return getStore("bee-photos");
}

// Serverseitige Admin-Allowlist - bewusst NICHT im Frontend-Bundle, sondern nur als
// Netlify-Umgebungsvariable (Site settings -> Environment variables -> ADMIN_USER_NAMES,
// z. B. "Entwickler"). So reicht es nicht, den Namen zu kennen oder den Client-Code zu
// lesen - man braucht zusätzlich den korrekten PIN des jeweiligen Kontos, UND der Name
// muss auf dieser Liste stehen, die nur Bernhard in Netlify pflegt.
function getServerAdminNames(): string[] {
  const raw = process.env.ADMIN_USER_NAMES ?? "";
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyAdmin(db: ReturnType<typeof getDatabase>, adminName: string, adminPin: string) {
  if (!adminName || !/^\d{4}$/.test(adminPin)) return false;
  if (!getServerAdminNames().includes(adminName.trim().toLowerCase())) return false;

  const [admin] = await db.sql`SELECT pin_hash FROM users WHERE lower(name) = lower(${adminName})`;
  if (!admin) return false;
  return admin.pin_hash === hashPin(adminPin);
}

const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const db = getDatabase();
  const body = await req.json();
  const adminName = String(body.adminName || "").trim();
  const adminPin = String(body.adminPin || "");
  const action = String(body.action || "");

  const isAdmin = await verifyAdmin(db, adminName, adminPin);
  if (!isAdmin) {
    // Absichtlich derselbe generische Fehler wie überall sonst - kein Hinweis darauf,
    // ob der Name existiert, der PIN falsch ist, oder die Admin-Berechtigung fehlt.
    return new Response("Nicht berechtigt", { status: 401 });
  }

  if (action === "list") {
    // entryCount ist nur fuer die Admin-Ansicht gedacht (Entwickler-Konto) - zeigt auf
    // einen Blick, ob ein Nutzer die App nach dem Anlegen des Kontos wirklich benutzt
    // (mind. 1 Tagebucheintrag) oder nur heruntergeladen/registriert und nie einen
    // Eintrag erfasst hat. Bewusst ueber eine Subquery auf entries statt eines
    // zusaetzlichen Zaehler-Felds auf der users-Tabelle, da entries schon die
    // verlaessliche Quelle der Wahrheit fuer echte Nutzung ist.
    const users = await db.sql`
      SELECT
        u.id, u.name, u.hive_count, u.created_at, u.is_gifted,
        (SELECT COUNT(*) FROM entries e WHERE e.user_id = u.id) AS entry_count
      FROM users u
      ORDER BY u.name
    `;
    return Response.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        hiveCount: u.hive_count,
        createdAt: u.created_at,
        isGifted: u.is_gifted,
        entryCount: Number(u.entry_count),
      }))
    );
  }

  if (action === "backdate") {
    // Nur für Test-/Demo-Konten gedacht (z. B. für Apple-App-Prüfung ein Konto mit
    // bereits abgelaufener Testphase bereitzustellen) - setzt created_at (nativer
    // Trial-Anker) UND web_trial_start (Web-Trial-Anker, siehe subscription.ts
    // trialAnchor()) künstlich zurück, damit isTrialActive() im Frontend auf BEIDEN
    // Plattformen "false" liefert. Vorher wurde hier nur created_at zurückgesetzt -
    // für Web-Konten blieb web_trial_start dadurch unverändert und die Testphase
    // erschien fälschlich weiter aktiv.
    await ensureSubscriptionColumns(db);
    const targetUserId = Number(body.targetUserId);
    const days = Number(body.days);
    if (!targetUserId) {
      return new Response("targetUserId ist erforderlich", { status: 400 });
    }
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return new Response("days muss zwischen 1 und 3650 liegen", { status: 400 });
    }
    const [user] = await db.sql`
      UPDATE users
      SET created_at = NOW() - (${days} * INTERVAL '1 day'),
          web_trial_start = NOW() - (${days} * INTERVAL '1 day')
      WHERE id = ${targetUserId}
      RETURNING id, name, hive_count, created_at, is_gifted, web_trial_start
    `;
    if (!user) {
      return new Response("Nutzer nicht gefunden", { status: 404 });
    }
    return Response.json({
      id: user.id,
      name: user.name,
      hiveCount: user.hive_count,
      createdAt: user.created_at,
      isGifted: user.is_gifted,
      webTrialStart: user.web_trial_start,
    });
  }

  if (action === "delete") {
    // Löscht ein Nutzerkonto komplett (z. B. nicht mehr benötigte Testaccounts) -
    // dieselbe Kaskade wie beim Selbstlöschen in users.mts (DELETE), nur admin-
    // ausgelöst statt mit dem eigenen PIN des Zielkontos.
    const targetUserId = Number(body.targetUserId);
    if (!targetUserId) {
      return new Response("targetUserId ist erforderlich", { status: 400 });
    }

    // Schutz gegen versehentliches Selbstlöschen des eigenen Admin-Kontos.
    const [adminRow] = await db.sql`SELECT id FROM users WHERE lower(name) = lower(${adminName})`;
    if (adminRow && adminRow.id === targetUserId) {
      return new Response("Das eigene Admin-Konto kann hier nicht gelöscht werden", { status: 400 });
    }

    const [target] = await db.sql`SELECT id, name FROM users WHERE id = ${targetUserId}`;
    if (!target) {
      return new Response("Nutzer nicht gefunden", { status: 404 });
    }

    // Zugehörige Fotos aus dem Blob-Speicher entfernen, bevor die Einträge gelöscht werden.
    const userEntries = await db.sql`SELECT photo_keys FROM entries WHERE user_id = ${targetUserId}`;
    const store = getPhotoStore();
    const allKeys = userEntries.flatMap((row) => (row.photo_keys as string[]) || []);
    await Promise.all(allKeys.map((k) => store.delete(k)));

    // Alle abhängigen Daten des Nutzers löschen (keine ON DELETE CASCADE-Regel auf den FKs),
    // erst danach den Nutzer selbst.
    await db.sql`DELETE FROM entries WHERE user_id = ${targetUserId}`;
    await db.sql`DELETE FROM hive_colors WHERE user_id = ${targetUserId}`;
    await db.sql`DELETE FROM annual_harvest WHERE user_id = ${targetUserId}`;
    await db.sql`DELETE FROM harvest_entries WHERE user_id = ${targetUserId}`;
    await db.sql`DELETE FROM users WHERE id = ${targetUserId}`;

    return Response.json({ id: target.id, name: target.name, deleted: true });
  }

  if (action === "grant" || action === "revoke") {
    const targetUserId = Number(body.targetUserId);
    if (!targetUserId) {
      return new Response("targetUserId ist erforderlich", { status: 400 });
    }
    const [user] = await db.sql`
      UPDATE users SET is_gifted = ${action === "grant"} WHERE id = ${targetUserId}
      RETURNING id, name, hive_count, created_at, is_gifted
    `;
    if (!user) {
      return new Response("Nutzer nicht gefunden", { status: 404 });
    }
    return Response.json({
      id: user.id,
      name: user.name,
      hiveCount: user.hive_count,
      createdAt: user.created_at,
      isGifted: user.is_gifted,
    });
  }

  return new Response("Unbekannte Aktion", { status: 400 });
};

export const config: Config = {
  path: "/api/admin",
};

export default withCors(handler);
