import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("key ist erforderlich", { status: 400 });
  }

  const store = getStore("bee-photos");
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const contentType = (result.metadata?.contentType as string) || "image/jpeg";
  return new Response(result.data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/photo",
};
