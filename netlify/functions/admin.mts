import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { createHash } from "node:crypto";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
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
    const users = await db.sql`
      SELECT id, name, hive_count, created_at, is_gifted
      FROM users
      ORDER BY name
    `;
    return Response.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        hiveCount: u.hive_count,
        createdAt: u.created_at,
        isGifted: u.is_gifted,
      }))
    );
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
