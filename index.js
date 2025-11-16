// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// Fixed version for relative URLs and Next.js assets

// ⚙️ Dein API Token hier eintragen:
const token = "nG6o2LHug8Sbqo2dy7MdE1T1OHzobu5d";

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

  // Check if this is a resource request (starts with /_next, /static, etc.)
  const isResourceRequest = url.pathname.startsWith('/_next') || 
                           url.pathname.startsWith('/static') ||
                           url.pathname.startsWith('/images') ||
                           url.pathname.startsWith('/assets') ||
                           url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/);

  let targetUrl;
  
  if (isResourceRequest) {
    // Für Resource-Requests: Verwende den Referer um die originale Domain zu finden
    const referer = request.headers.get('referer');
    if (referer) {
      const refererUrl = new URL(referer);
      const originalTarget = decodeURIComponent(refererUrl.search.slice(1));
      if (originalTarget && originalTarget.startsWith('http')) {
        const baseUrl = new URL(originalTarget);
        targetUrl = new URL(url.pathname + url.search, baseUrl.origin);
      }
    }
  }

  // Falls kein Resource-Request oder kein Referer gefunden, verwende den normalen Query-Parameter
  if (!targetUrl) {
    const target = decodeURIComponent(url.search.slice(1));
    if (!target || !target.startsWith("http")) {
      return new Response(
        "Usage:\n  https://dein-worker.workers.dev/?https://ziel-url.com\n\nFor resources: Automatically uses referer to construct full URL",
        { status: 400, headers: { "Content-Type": "text/plain" } }
      );
    }
    targetUrl = new URL(target);
  }

  // Ursprüngliche Headers übernehmen
  const headers = new Headers(request.headers);
  
  // Origin Header für die Zielseite entfernen (CORS Vermeidung)
  headers.delete("Origin");
  headers.delete("Referer");

  // Eigene Header erzwingen
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  
  // Authorization Header falls Token vorhanden
  if (token && !isResourceRequest) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Request an Ziel weiterleiten
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
    response = await fetch(targetUrl.toString(), init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  // Response verarbeiten basierend auf Content-Type
  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("text/html")) {
    // HTML Inhalt - relative URLs korrigieren
    let body = await response.text();
    
    // Base URL für alle relativen Links setzen
    const baseHref = `<base href="${targetUrl.origin}/">`;
    body = body.replace(/<head[^>]*>/, `$&${baseHref}`);
    
    // Alle relativen URLs in absolute URLs umwandeln
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        return `${attr}="${targetUrl.origin}${path}"`;
      }
    );
    
    // URLs ohne führenden Slash (relative Pfade)
    body = body.replace(
      /(href|src|action)=["']((?!https?:\/\/|data:)([^"':][^"']*))["']/gi,
      (match, attr, path) => {
        if (path.startsWith('/')) return match;
        const basePath = targetUrl.pathname.endsWith('/') ? targetUrl.pathname : 
                         targetUrl.pathname.split('/').slice(0, -1).join('/') + '/';
        return `${attr}="${targetUrl.origin}${basePath}${path}"`;
      }
    );

    // CSS URLs in HTML korrigieren
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      `url("${targetUrl.origin}$1")`
    );

    // Response mit korrigiertem Body erstellen
    const newHeaders = new Headers(response.headers);
    
    // Sicherheitsheaders entfernen für iframe
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('Frame-Options');
    
    // CORS-Header hinzufügen
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');
    
    // Content-Type sicherstellen
    if (!newHeaders.has('Content-Type')) {
      newHeaders.set('Content-Type', contentType);
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    
  } else if (contentType.includes("text/css")) {
    // CSS Dateien - URLs korrigieren
    let body = await response.text();
    
    // Relative URLs in CSS
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      `url("${targetUrl.origin}$1")`
    );
    
    body = body.replace(
      /url\(['"]?((?!https?:\/\/|data:)([^)'"]*))['"]?\)/gi,
      (match, path) => {
        if (path.startsWith('/')) return match;
        const basePath = targetUrl.pathname.endsWith('/') ? targetUrl.pathname : 
                         targetUrl.pathname.split('/').slice(0, -1).join('/') + '/';
        return `url("${targetUrl.origin}${basePath}${path}")`;
      }
    );

    const newHeaders = new Headers(response.headers);
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Content-Type', 'text/css');

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    
  } else {
    // Andere Content-Types (JSON, Bilder, JS, etc.)
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
}
