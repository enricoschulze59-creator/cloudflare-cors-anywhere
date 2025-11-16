// Cloudflare Worker: Joyn API Proxy with Custom Endpoint Redirect
// Leitet Joyn GraphQL Anfragen zu tv-livestream.live um

const token = "nG6o2LHug8Sbqo2dy7MdE1T1OHzobu5d";

// Konfiguration für URL-Rewriting
const REWRITE_RULES = [
  {
    from: 'api.joyn.de/graphql',
    to: 'tv-livestream.live/joyn_api.php/graphql'
  }
];

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // OPTIONS Request für Preflight handling
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  const target = decodeURIComponent(url.searchParams.get('url') || url.search.slice(1));

  if (!target || !target.startsWith("http")) {
    return new Response(
      "Usage:\n  https://dein-worker.workers.dev/?url=https://ziel-url.com\n\nJoyn API Proxy with custom endpoint redirect",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  let targetUrl = new URL(target);
  
  // URL Rewriting anwenden
  const originalUrl = targetUrl.toString();
  let rewrittenUrl = originalUrl;
  
  for (const rule of REWRITE_RULES) {
    if (originalUrl.includes(rule.from)) {
      rewrittenUrl = originalUrl.replace(rule.from, rule.to);
      break;
    }
  }
  
  // Wenn URL geändert wurde, neue TargetUrl erstellen
  if (rewrittenUrl !== originalUrl) {
    targetUrl = new URL(rewrittenUrl);
    console.log(`Rewritten URL: ${originalUrl} -> ${rewrittenUrl}`);
  }

  // Request vorbereiten
  const headers = new Headers(request.headers);
  
  // Origin und Referer Header anpassen
  headers.delete("Origin");
  headers.delete("Referer");
  
  // Host Header setzen basierend auf Ziel-URL
  headers.set("Host", targetUrl.host);
  
  // Standard Header
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  // Dein Token falls vorhanden
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Joyn-spezifische Header für Joyn-Domains
  const isJoynRelated = originalUrl.includes('joyn.de') || rewrittenUrl.includes('joyn_api.php');
  if (isJoynRelated) {
    // Wichtige Joyn Header setzen
    headers.set('content-type', 'application/json');
    headers.set('x-api-key', '4f0fd9f18abbe3cf0e87fdb556bc39c8');
    headers.set('joyn-platform', 'web');
    headers.set('joyn-country', 'DE');
    
    // Origin für CORS setzen
    headers.set('origin', 'https://www.joyn.de');
  }

  const init = {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" && request.body
      ? await request.text()
      : undefined,
    redirect: "follow",
  };

  let response;
  try {
    console.log(`Proxying to: ${targetUrl.toString()}`);
    response = await fetch(targetUrl.toString(), init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  // Response Header anpassen
  const newHeaders = new Headers(response.headers);
  
  // Sicherheitsheaders entfernen
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('Frame-Options');
  
  // CORS-Header hinzufügen
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');

  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
