// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter, entfernt Sicherheitsheaders
// und korrigiert relative URLs für iframe-Einbettung

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

  const target = decodeURIComponent(url.search.slice(1));

  if (!target || !target.startsWith("http")) {
    return new Response(
      "Usage:\n  https://dein-worker.workers.dev/?https://ziel-url.com/api\n\nEnhanced Features:\n- Removes X-Frame-Options & CSP\n- Fixes relative URLs\n- CORS enabled",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  const targetUrl = new URL(target);
  
  // Ursprüngliche Headers übernehmen
  const headers = new Headers(request.headers);
  
  // Origin Header für die Zielseite entfernen (CORS Vermeidung)
  headers.delete("Origin");
  headers.delete("Referer");

  // Eigene Header erzwingen
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  
  // Authorization Header falls Token vorhanden
  if (token) {
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
    response = await fetch(target, init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  // Response verarbeiten basierend auf Content-Type
  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("text/html") || contentType.includes("text/css")) {
    // HTML/CSS Inhalt - relative URLs korrigieren
    let body = await response.text();
    
    // Relative URLs in absolute URLs umwandeln
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      `$1="${
        targetUrl.origin + 
        (targetUrl.pathname.endsWith('/') ? targetUrl.pathname.slice(0, -1) : 
         targetUrl.pathname.includes('.') ? targetUrl.pathname.split('/').slice(0, -1).join('/') || '' : 
         targetUrl.pathname)
      }$2"`
    );
    
    // URLs ohne führenden Slash
    body = body.replace(
      /(href|src|action)=["']((?!https?:\/\/)[^"':][^"']*)["']/gi,
      (match, attr, path) => {
        if (path.startsWith('/')) return match;
        const basePath = targetUrl.pathname.endsWith('/') ? targetUrl.pathname : 
                         targetUrl.pathname.split('/').slice(0, -1).join('/') + '/';
        return `${attr}="${targetUrl.origin}${basePath}${path}"`;
      }
    );

    // CSS URLs korrigieren
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
    
  } else {
    // Andere Content-Types (JSON, etc.) - nur Headers anpassen
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
