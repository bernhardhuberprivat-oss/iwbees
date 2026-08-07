import type { Context } from "@netlify/functions";

// Die native iOS-App läuft aus einem lokalen Bundle (eigene Origin) statt von
// iwbees.netlify.app selbst, daher braucht jede Function CORS-Header, damit die
// App-Anfragen nicht vom Browser/WebView blockiert werden. Die Web-Version
// (gleiche Origin) ist davon nicht betroffen.
type Handler = (req: Request, context: Context) => Response | Promise<Response>;

function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function withCors(handler: Handler): Handler {
  return async (req: Request, context: Context) => {
    const headers = corsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const response = await handler(req, context);
    const merged = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) {
      merged.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  };
}
