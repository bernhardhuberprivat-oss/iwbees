import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getStore } from "@netlify/blobs";

// Liefert die rohen Audio-Bytes einer Sprachnotiz aus - eigene Function statt Teil von
// voice-notes.mts, exakt analog zu photo.mts fuer Fotos (eigener Pfad, damit ein
// <audio src="..."> direkt darauf zeigen kann, ohne JSON drumherum).
const handler = async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("key ist erforderlich", { status: 400 });
  }

  const store = getStore("bee-voice-notes");
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const contentType = (result.metadata?.contentType as string) || "audio/webm";
  return new Response(result.data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/voice-note-audio",
};

export default withCors(handler);
