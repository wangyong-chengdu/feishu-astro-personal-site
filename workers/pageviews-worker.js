const ALLOWED_ORIGINS = new Set([
  "https://wangyong-chengdu.github.io",
  "https://wangyong.dev",
  "https://cdwangyong.dev",
  "https://cdwangyong.com",
  "http://127.0.0.1:4328",
  "http://localhost:4328"
]);

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://wangyong-chengdu.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function normalizePath(rawPath) {
  const path = rawPath || "/";
  return path.replace(/[?#].*$/, "").replace(/\/{2,}/g, "/").slice(0, 240);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.searchParams.get("path"));
    const key = `views:${path}`;
    const current = Number((await env.PAGEVIEWS.get(key)) || "0");
    const views = request.method === "POST" ? current + 1 : current;

    if (request.method === "POST") {
      await env.PAGEVIEWS.put(key, String(views));
    }

    return Response.json({ path, views }, { headers });
  }
};
