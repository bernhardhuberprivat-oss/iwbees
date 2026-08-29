import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { Entry, HiveInfo } from "./types";
import { Lang, dateLocale, useT } from "./i18n";

// PDF-Export für die Tagebucheinträge eines Stocks (oder aller Stöcke auf einmal) -
// erreichbar über den "hive-actions-bar" (einzelner Stock) bzw. den Button auf dem
// "Alle"-Reiter (Diary in App.tsx). Bewusst reiner Text-/Daten-Export ohne eingebettete
// Fotos (siehe PhotoTimeline.tsx für die Fotos separat) - hält die Datei klein und die
// Erstellung auch auf älteren Geräten/offline schnell.
type T = ReturnType<typeof useT>;

const HONEY_RGB: [number, number, number] = [232, 163, 61];
const MARGIN = 40;

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // Umlaute/Akzente zu ihren Basisbuchstaben
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "export"
  );
}

function formatDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(dateLocale(lang));
}

function sightingsText(entry: Entry, t: T): string {
  const seen = [
    entry.sighting_queen && t.entryForm.sightingQueen,
    entry.sighting_larvae && t.entryForm.sightingLarvae,
    entry.sighting_eggs && t.entryForm.sightingEggs,
    entry.sighting_brood && t.entryForm.sightingBrood,
  ].filter(Boolean) as string[];
  const parts: string[] = [];
  if (seen.length > 0) parts.push(seen.join(", "));
  if (entry.occupied_combs != null) parts.push(`${t.entryForm.occupiedCombs}: ${entry.occupied_combs}`);
  if (entry.queen_cells != null) parts.push(`${t.entryForm.queenCells}: ${entry.queen_cells}`);
  if (entry.varroa_mites != null) {
    parts.push(`${t.entryForm.varroaMites}: ${entry.varroa_mites ? t.common.yes : t.common.no}`);
  }
  return parts.length > 0 ? parts.join(" · ") : t.common.none;
}

function entryRows(entries: Entry[], t: T, lang: Lang): string[][] {
  return entries.map((e) => [
    formatDate(e.entry_date, lang),
    e.colony_strength ? t.strengthLabels[e.colony_strength] ?? e.colony_strength : t.common.none,
    e.varroa || t.common.none,
    e.feeding || t.common.none,
    e.weight_kg != null ? String(e.weight_kg) : t.common.none,
    sightingsText(e, t),
    e.notes || t.common.none,
  ]);
}

function tableHead(t: T): string[][] {
  return [
    [
      t.pdfExport.colDate,
      t.pdfExport.colStrength,
      t.pdfExport.colVarroa,
      t.pdfExport.colFeeding,
      t.pdfExport.colWeight,
      t.pdfExport.colSightings,
      t.pdfExport.colNotes,
    ],
  ];
}

function stammdatenLine(
  info: HiveInfo | undefined,
  varroaMitesActive: boolean,
  latestWeightKg: number | null,
  t: T
): string {
  const parts: string[] = [];
  if (info?.category) parts.push(`${t.pdfExport.category}: ${t.categories[info.category] ?? info.category}`);
  if (info?.queenYear) parts.push(`${t.pdfExport.queenYear}: ${info.queenYear}`);
  if (info?.colonyStrength) {
    parts.push(`${t.pdfExport.colonyStrength}: ${t.strengthLabels[info.colonyStrength] ?? info.colonyStrength}`);
  }
  if (latestWeightKg != null) parts.push(`${t.pdfExport.currentWeight}: ${latestWeightKg} kg`);
  parts.push(`${t.pdfExport.varroaActive}: ${varroaMitesActive ? t.common.yes : t.common.no}`);
  return parts.join(" · ");
}

// Ermittelt je Stock den jeweils neuesten (nicht-leeren) Wert eines Felds - entries MUSS
// bereits neueste-zuerst sortiert sein (siehe mergeWithPending() in App.tsx, das ist
// immer der Fall für den entries-State). Gleiche Logik wie die einzelne
// latestVarroaEntry/latestWeightEntry-Ableitung in App.tsx, nur pro Stock statt nur für
// den aktuell ausgewählten.
function latestByHive<K extends "varroa_mites" | "weight_kg">(
  entries: Entry[],
  field: K
): Record<number, Entry[K]> {
  const result: Record<number, Entry[K]> = {};
  for (const e of entries) {
    if (result[e.hive] !== undefined) continue;
    const val = e[field];
    if (val !== null && val !== undefined) result[e.hive] = val;
  }
  return result;
}

async function saveOrSharePdf(doc: jsPDF, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.substring(dataUri.indexOf(",") + 1);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: written.uri });
  } else {
    doc.save(filename);
  }
}

function addTitle(doc: jsPDF, title: string, generatedOn: string) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 120, 95);
  doc.text(generatedOn, MARGIN, 56);
  doc.setTextColor(20, 20, 20);
}

function addHiveSection(
  doc: jsPDF,
  startY: number,
  hiveLabel: string,
  info: HiveInfo | undefined,
  varroaMitesActive: boolean,
  latestWeightKg: number | null,
  entries: Entry[],
  t: T,
  lang: Lang,
  withHeading: boolean
) {
  let y = startY;
  if (withHeading) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(hiveLabel, MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += 18;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(9.5);
  doc.setTextColor(90, 70, 50);
  const meta = stammdatenLine(info, varroaMitesActive, latestWeightKg, t);
  const metaLines = doc.splitTextToSize(meta, pageWidth - MARGIN * 2);
  doc.text(metaLines, MARGIN, y);
  doc.setTextColor(20, 20, 20);
  y += metaLines.length * 12 + 10;

  if (entries.length === 0) {
    doc.setFontSize(10);
    doc.text(t.pdfExport.noEntries, MARGIN, y);
    return y + 16;
  }

  autoTable(doc, {
    startY: y,
    head: tableHead(t),
    body: entryRows(entries, t, lang),
    styles: { fontSize: 8, cellPadding: 4, valign: "top", textColor: [30, 24, 16] },
    headStyles: { fillColor: HONEY_RGB, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [253, 245, 232] },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 60 },
      4: { cellWidth: 55 },
    },
  });

  // @ts-expect-error - jspdf-autotable erweitert jsPDF zur Laufzeit um lastAutoTable
  return (doc.lastAutoTable?.finalY as number) ?? y;
}

export async function exportHivePdf(opts: {
  hiveLabel: string;
  hiveInfo?: HiveInfo;
  varroaMitesActive: boolean;
  latestWeightKg: number | null;
  entries: Entry[];
  t: T;
  lang: Lang;
}) {
  const { hiveLabel, hiveInfo, varroaMitesActive, latestWeightKg, entries, t, lang } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  addTitle(doc, t.pdfExport.reportTitleHive(hiveLabel), t.pdfExport.generatedOn(formatDate(new Date().toISOString(), lang)));
  addHiveSection(doc, 78, hiveLabel, hiveInfo, varroaMitesActive, latestWeightKg, entries, t, lang, false);

  await saveOrSharePdf(doc, `isybee-${sanitizeFilename(hiveLabel)}.pdf`);
}

export async function exportAllHivesPdf(opts: {
  hiveInfo: Record<number, HiveInfo>;
  entries: Entry[];
  t: T;
  lang: Lang;
  hiveFallbackLabel: (n: number) => string;
}) {
  const { hiveInfo, entries, t, lang, hiveFallbackLabel } = opts;

  const byHive = new Map<number, Entry[]>();
  for (const e of entries) {
    if (!byHive.has(e.hive)) byHive.set(e.hive, []);
    byHive.get(e.hive)!.push(e);
  }
  const hiveNumbers = Array.from(byHive.keys()).sort((a, b) => a - b);
  const varroaByHive = latestByHive(entries, "varroa_mites");
  const weightByHive = latestByHive(entries, "weight_kg");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  addTitle(doc, t.pdfExport.reportTitleAll, t.pdfExport.generatedOn(formatDate(new Date().toISOString(), lang)));

  if (hiveNumbers.length === 0) {
    doc.setFontSize(10);
    doc.text(t.pdfExport.noEntries, MARGIN, 90);
  }

  hiveNumbers.forEach((hive, idx) => {
    if (idx > 0) doc.addPage();
    const startY = idx === 0 ? 78 : 46;
    const label = hiveInfo[hive]?.name?.trim() || hiveFallbackLabel(hive);
    const weightRaw = weightByHive[hive];
    addHiveSection(
      doc,
      startY,
      label,
      hiveInfo[hive],
      Boolean(varroaByHive[hive]),
      weightRaw != null ? Number(weightRaw) : null,
      byHive.get(hive)!,
      t,
      lang,
      true
    );
  });

  const filename = lang === "en" ? "isybee-full-report.pdf" : "isybee-gesamtbericht.pdf";
  await saveOrSharePdf(doc, filename);
}
