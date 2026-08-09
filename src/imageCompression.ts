// Verkleinert Fotos im Browser (über <canvas>), bevor sie hochgeladen werden.
//
// Hintergrund: iPhone-Kamerafotos sind oft mehrere MB groß (teils im HEIC-Format).
// Die Netlify Function, die neue Tageseinträge entgegennimmt, läuft auf AWS Lambda und
// hat ein Anfragelimit von ca. 6 MB - mehrere unkomprimierte Fotos in einem Eintrag
// (oder auch nur ein einzelnes hochauflösendes Foto) können das überschreiten. Der
// Upload schlägt dann fehl, und im schlimmsten Fall (Eintrag landet dabei fälschlich in
// der Offline-Warteschlange und wird beim nächsten Sync-Versuch vom Server abgelehnt)
// geht der ganze Eintrag inklusive Foto stillschweigend verloren.
//
// Deshalb werden Fotos hier vor dem Hochladen auf eine vernünftige Maximalgröße
// herunterskaliert und als JPEG neu kodiert.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImage(
  file: File,
  maxDimension: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // z.B. ein Format, das der Browser nicht per createImageBitmap dekodieren kann -
    // dann lieber das Original hochladen als den ganzen Eintrag scheitern zu lassen.
    return file;
  }
}

export async function compressImages(
  files: File[],
  maxDimension?: number,
  quality?: number
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxDimension, quality)));
}
