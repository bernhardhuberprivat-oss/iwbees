import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

function getPhotoStore() {
  return getStore("bee-photos");
}

function parseBool(v: FormDataEntryValue | null): boolean {
  return v === "true";
}

function parseTriBool(v: FormDataEntryValue | null): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export default async (req: Request, context: Context) => {
  const db = getDatabase();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const hive = url.searchParams.get("hive");
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    const rows = hive
      ? await db.sql`SELECT * FROM entries WHERE user_id = ${userId} AND hive = ${Number(hive)} ORDER BY entry_date DESC, id DESC`
      : await db.sql`SELECT * FROM entries WHERE user_id = ${userId} ORDER BY entry_date DESC, id DESC`;
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const form = await req.formData();
    const userId = Number(form.get("userId"));
    const hive = Number(form.get("hive"));
    const entryDate = String(form.get("entryDate") || "");
    const notes = String(form.get("notes") || "");
    const queenColor = form.get("queenColor") ? String(form.get("queenColor")) : null;
    const queenYearRaw = form.get("queenYear");
    const queenYear = queenYearRaw ? Number(queenYearRaw) : null;
    const colonyStrength = String(form.get("colonyStrength") || "");
    const varroa = String(form.get("varroa") || "");
    const feeding = String(form.get("feeding") || "");
    const honeyHarvestRaw = form.get("honeyHarvestKg");
    const honeyHarvestKg = honeyHarvestRaw ? Number(honeyHarvestRaw) : null;
    const weightRaw = form.get("weightKg");
    const weightKg = weightRaw ? Number(weightRaw) : null;
    const sightingQueen = parseBool(form.get("sightingQueen"));
    const sightingLarvae = parseBool(form.get("sightingLarvae"));
    const sightingEggs = parseBool(form.get("sightingEggs"));
    const sightingBrood = parseBool(form.get("sightingBrood"));
    const occupiedCombsRaw = form.get("occupiedCombs");
    const occupiedCombs = occupiedCombsRaw ? Number(occupiedCombsRaw) : null;
    const queenCellsRaw = form.get("queenCells");
    const queenCells = queenCellsRaw ? Number(queenCellsRaw) : null;
    const varroaMites = parseTriBool(form.get("varroaMites"));

    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    if (!hive || hive < 1 || hive > 10 || !entryDate) {
      return new Response("hive (1-10) und entryDate sind erforderlich", { status: 400 });
    }

    const photos = form.getAll("photos").filter((p): p is File => p instanceof File && p.size > 0);
    const store = getPhotoStore();
    const photoKeys: string[] = [];

    for (const photo of photos) {
      const key = randomUUID();
      await store.set(key, await photo.arrayBuffer(), {
        metadata: { contentType: photo.type || "image/jpeg" },
      });
      photoKeys.push(key);
    }

    const [row] = await db.sql`
      INSERT INTO entries (
        user_id, hive, entry_date, notes, queen_color, queen_year, colony_strength, varroa, feeding,
        honey_harvest_kg, weight_kg,
        sighting_queen, sighting_larvae, sighting_eggs, sighting_brood,
        occupied_combs, queen_cells, varroa_mites,
        photo_keys
      )
      VALUES (
        ${userId}, ${hive}, ${entryDate}, ${notes}, ${queenColor}, ${queenYear}, ${colonyStrength}, ${varroa}, ${feeding},
        ${honeyHarvestKg}, ${weightKg},
        ${sightingQueen}, ${sightingLarvae}, ${sightingEggs}, ${sightingBrood},
        ${occupiedCombs}, ${queenCells}, ${varroaMites},
        ${JSON.stringify(photoKeys)}
      )
      RETURNING *
    `;

    return Response.json(row, { status: 201 });
  }

  if (req.method === "PUT") {
    const form = await req.formData();
    const id = Number(form.get("id"));
    const userId = Number(form.get("userId"));

    if (!id || !userId) {
      return new Response("id und userId sind erforderlich", { status: 400 });
    }

    const [existing] = await db.sql`SELECT * FROM entries WHERE id = ${id} AND user_id = ${userId}`;
    if (!existing) {
      return new Response("Eintrag nicht gefunden", { status: 404 });
    }

    const entryDate = String(form.get("entryDate") || existing.entry_date);
    const notes = String(form.get("notes") || "");
    const queenColor = form.get("queenColor") ? String(form.get("queenColor")) : null;
    const queenYearRaw = form.get("queenYear");
    const queenYear = queenYearRaw ? Number(queenYearRaw) : null;
    const colonyStrength = String(form.get("colonyStrength") || "");
    const varroa = String(form.get("varroa") || "");
    const feeding = String(form.get("feeding") || "");
    const honeyHarvestRaw = form.get("honeyHarvestKg");
    const honeyHarvestKg = honeyHarvestRaw ? Number(honeyHarvestRaw) : null;
    const weightRaw = form.get("weightKg");
    const weightKg = weightRaw ? Number(weightRaw) : null;
    const sightingQueen = parseBool(form.get("sightingQueen"));
    const sightingLarvae = parseBool(form.get("sightingLarvae"));
    const sightingEggs = parseBool(form.get("sightingEggs"));
    const sightingBrood = parseBool(form.get("sightingBrood"));
    const occupiedCombsRaw = form.get("occupiedCombs");
    const occupiedCombs = occupiedCombsRaw ? Number(occupiedCombsRaw) : null;
    const queenCellsRaw = form.get("queenCells");
    const queenCells = queenCellsRaw ? Number(queenCellsRaw) : null;
    const varroaMites = parseTriBool(form.get("varroaMites"));

    // Fotos: der Client schickt die Keys der Fotos, die behalten werden sollen -
    // alles andere aus dem bisherigen Bestand wird gelöscht. Neue Dateien kommen dazu.
    const existingKeys: string[] = existing.photo_keys || [];
    let keepKeys: string[];
    try {
      keepKeys = JSON.parse(String(form.get("keepPhotoKeys") || "[]"));
    } catch {
      keepKeys = existingKeys;
    }
    keepKeys = keepKeys.filter((k) => existingKeys.includes(k));
    const removedKeys = existingKeys.filter((k) => !keepKeys.includes(k));

    const store = getPhotoStore();
    await Promise.all(removedKeys.map((k) => store.delete(k)));

    const newPhotos = form.getAll("photos").filter((p): p is File => p instanceof File && p.size > 0);
    const newKeys: string[] = [];
    for (const photo of newPhotos) {
      const key = randomUUID();
      await store.set(key, await photo.arrayBuffer(), {
        metadata: { contentType: photo.type || "image/jpeg" },
      });
      newKeys.push(key);
    }

    const finalKeys = [...keepKeys, ...newKeys];

    const [row] = await db.sql`
      UPDATE entries
      SET entry_date = ${entryDate},
          notes = ${notes},
          queen_color = ${queenColor},
          queen_year = ${queenYear},
          colony_strength = ${colonyStrength},
          varroa = ${varroa},
          feeding = ${feeding},
          honey_harvest_kg = ${honeyHarvestKg},
          weight_kg = ${weightKg},
          sighting_queen = ${sightingQueen},
          sighting_larvae = ${sightingLarvae},
          sighting_eggs = ${sightingEggs},
          sighting_brood = ${sightingBrood},
          occupied_combs = ${occupiedCombs},
          queen_cells = ${queenCells},
          varroa_mites = ${varroaMites},
          photo_keys = ${JSON.stringify(finalKeys)}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    return Response.json(row);
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const userId = Number(url.searchParams.get("userId"));
    if (!id || !userId) {
      return new Response("id und userId sind erforderlich", { status: 400 });
    }

    const [row] = await db.sql`SELECT photo_keys FROM entries WHERE id = ${Number(id)} AND user_id = ${userId}`;
    if (row) {
      const store = getPhotoStore();
      const keys: string[] = row.photo_keys || [];
      await Promise.all(keys.map((k) => store.delete(k)));
    }

    await db.sql`DELETE FROM entries WHERE id = ${Number(id)} AND user_id = ${userId}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/entries",
};
