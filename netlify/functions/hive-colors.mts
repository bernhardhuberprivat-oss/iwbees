import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";

const handler = async (req: Request, context: Context) => {
  const db = getDatabase();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    const rows = await db.sql`
      SELECT hive, color, name, category, queen_year, colony_strength, weight_kg,
             sighting_queen, sighting_larvae, sighting_eggs, sighting_brood,
             occupied_combs, queen_cells, varroa_mites
      FROM hive_colors WHERE user_id = ${userId}
    `;
    const info: Record<number, Record<string, unknown>> = {};
    for (const row of rows) {
      const hasAny =
        row.color || row.name || row.category || row.queen_year || row.colony_strength ||
        row.weight_kg != null ||
        row.sighting_queen || row.sighting_larvae || row.sighting_eggs || row.sighting_brood ||
        row.occupied_combs != null || row.queen_cells != null || row.varroa_mites != null;
      if (hasAny) {
        info[row.hive] = {
          color: row.color || null,
          name: row.name || null,
          category: row.category || null,
          queenYear: row.queen_year ?? null,
          colonyStrength: row.colony_strength || null,
          weightKg: row.weight_kg ?? null,
          sightingQueen: !!row.sighting_queen,
          sightingLarvae: !!row.sighting_larvae,
          sightingEggs: !!row.sighting_eggs,
          sightingBrood: !!row.sighting_brood,
          occupiedCombs: row.occupied_combs ?? null,
          queenCells: row.queen_cells ?? null,
          varroaMites: row.varroa_mites ?? null,
        };
      }
    }
    return Response.json(info);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const userId = Number(body.userId);
    const hive = Number(body.hive);

    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    if (!hive || hive < 1 || hive > 60) {
      return new Response("hive (1-60) ist erforderlich", { status: 400 });
    }

    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

    const [existing] = await db.sql`
      SELECT color, name, category, queen_year, colony_strength, weight_kg,
             sighting_queen, sighting_larvae, sighting_eggs, sighting_brood,
             occupied_combs, queen_cells, varroa_mites
      FROM hive_colors WHERE user_id = ${userId} AND hive = ${hive}
    `;

    const color: string | null = has("color") ? (body.color || null) : existing?.color ?? null;
    const name: string | null = has("name") ? (body.name ? String(body.name).trim() || null : null) : existing?.name ?? null;
    const category: string | null = has("category") ? (body.category || null) : existing?.category ?? null;
    const queenYear: number | null = has("queenYear")
      ? (body.queenYear ? Number(body.queenYear) : null)
      : existing?.queen_year ?? null;
    const colonyStrength: string | null = has("colonyStrength")
      ? (body.colonyStrength || null)
      : existing?.colony_strength ?? null;
    const weightKg: number | null = has("weightKg")
      ? (body.weightKg === null || body.weightKg === "" ? null : Number(body.weightKg))
      : existing?.weight_kg ?? null;

    const sightingQueen: boolean = has("sightingQueen") ? !!body.sightingQueen : existing?.sighting_queen ?? false;
    const sightingLarvae: boolean = has("sightingLarvae") ? !!body.sightingLarvae : existing?.sighting_larvae ?? false;
    const sightingEggs: boolean = has("sightingEggs") ? !!body.sightingEggs : existing?.sighting_eggs ?? false;
    const sightingBrood: boolean = has("sightingBrood") ? !!body.sightingBrood : existing?.sighting_brood ?? false;
    const occupiedCombs: number | null = has("occupiedCombs")
      ? (body.occupiedCombs === null || body.occupiedCombs === "" ? null : Number(body.occupiedCombs))
      : existing?.occupied_combs ?? null;
    const queenCells: number | null = has("queenCells")
      ? (body.queenCells === null || body.queenCells === "" ? null : Number(body.queenCells))
      : existing?.queen_cells ?? null;
    const varroaMites: boolean | null = has("varroaMites")
      ? (body.varroaMites === null ? null : !!body.varroaMites)
      : existing?.varroa_mites ?? null;

    await db.sql`
      INSERT INTO hive_colors (
        user_id, hive, color, name, category, queen_year, colony_strength, weight_kg,
        sighting_queen, sighting_larvae, sighting_eggs, sighting_brood,
        occupied_combs, queen_cells, varroa_mites
      )
      VALUES (
        ${userId}, ${hive}, ${color}, ${name}, ${category}, ${queenYear}, ${colonyStrength}, ${weightKg},
        ${sightingQueen}, ${sightingLarvae}, ${sightingEggs}, ${sightingBrood},
        ${occupiedCombs}, ${queenCells}, ${varroaMites}
      )
      ON CONFLICT (user_id, hive) DO UPDATE SET
        color = ${color}, name = ${name}, category = ${category}, queen_year = ${queenYear},
        colony_strength = ${colonyStrength}, weight_kg = ${weightKg},
        sighting_queen = ${sightingQueen}, sighting_larvae = ${sightingLarvae},
        sighting_eggs = ${sightingEggs}, sighting_brood = ${sightingBrood},
        occupied_combs = ${occupiedCombs}, queen_cells = ${queenCells}, varroa_mites = ${varroaMites}
    `;

    return Response.json({
      hive, color, name, category, queenYear, colonyStrength, weightKg,
      sightingQueen, sightingLarvae, sightingEggs, sightingBrood,
      occupiedCombs, queenCells, varroaMites,
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/hive-colors",
};

export default withCors(handler);
