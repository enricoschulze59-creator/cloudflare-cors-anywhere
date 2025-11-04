// Cloudflare Worker: Auth-CORS Proxy
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter und hängt automatisch
// die Header "Authorization" und "Accept" an.
// Aufruf: https://dein-worker.workers.dev/?https://ziel-url.com/pfad

// ⚙️ Dein API Token hier eintragen:
const token = "4f0fd9f18abbe3cf0e87fdb556bc39c8";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const target = decodeURIComponent(url.search.slice(1));

  if (!target || !target.startsWith("http")) {
    return new Response(
      "Usage:\n  https://dein-worker.workers.dev/?https://ziel-url.com/api\n",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Ursprüngliche Headers übernehmen
  const headers = new Headers(request.headers);

  // Eigene Header erzwingen
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  // Request an Ziel weiterleiten
  const init = {
    method: request.method,
    headers,
    body:
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body
        ? await request.text()
        : undefined,
    redirect: "follow",
  };

  let response;
  try {
    response = await fetch(target, init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  // CORS-Header hinzufügen
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
  };

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
