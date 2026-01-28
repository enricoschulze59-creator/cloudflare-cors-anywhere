// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// Simplified version for better URL handling

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
  
  // Headers vorbereiten
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.delete("Referer");
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Request weiterleiten
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

  // Content-Type prüfen
  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("text/html") || contentType.includes("text/css") || contentType.includes("javascript")) {
    let body = await response.text();
    
    // EINFACHE LOGIK: Alle relativen URLs basierend auf der Ziel-URL-Struktur korrigieren
    const baseUrl = targetUrl.origin;
    const pathname = targetUrl.pathname;
    
    // Basis-Pfad für relative URLs bestimmen
    // Wenn die URL auf eine Datei zeigt (mit Erweiterung), gehe zum übergeordneten Verzeichnis
    let basePath = "/";
    if (pathname.includes('.') && !pathname.endsWith('/')) {
      // Datei gefunden - gehe ein Verzeichnis zurück
      const lastSlash = pathname.lastIndexOf('/');
      if (lastSlash > 0) {
        basePath = pathname.substring(0, lastSlash + 1);
      }
    } else {
      // Verzeichnis oder andere Ressource
      basePath = pathname.endsWith('/') ? pathname : pathname + '/';
    }
    
    console.log(`Base URL: ${baseUrl}, Base Path: ${basePath}`);
    
    // Funktion zum Korrigieren von URLs
    const fixUrl = (urlToFix) => {
      // Wenn es bereits eine vollständige URL oder Data-URL ist, unverändert lassen
      if (urlToFix.startsWith('http://') || urlToFix.startsWith('https://') || 
          urlToFix.startsWith('//') || urlToFix.startsWith('data:') || 
          urlToFix.startsWith('#')) {
        return urlToFix;
      }
      
      // Absolute Pfade (beginnend mit /)
      if (urlToFix.startsWith('/')) {
        return baseUrl + urlToFix;
      }
      
      // Relative Pfade
      return baseUrl + basePath + urlToFix;
    };
    
    // 1. href, src, action Attribute korrigieren
    body = body.replace(
      /(href|src|action)=["']([^"']*)["']/gi,
      (match, attr, url) => {
        return `${attr}="${fixUrl(url)}"`;
      }
    );
    
    // 2. CSS url() korrigieren
    body = body.replace(
      /url\(['"]?([^)'"]*)['"]?\)/gi,
      (match, url) => {
        // Data URLs und absolute URLs überspringen
        if (url.startsWith('data:') || url.startsWith('http://') || 
            url.startsWith('https://') || url.startsWith('//') ||
            url === 'none' || url === 'inherit') {
          return match;
        }
        return `url("${fixUrl(url)}")`;
      }
    );
    
    // 3. srcset Attribute korrigieren
    body = body.replace(
      /srcset=["']([^"']+)["']/gi,
      (match, srcset) => {
        const parts = srcset.split(',').map(part => {
          const trimmed = part.trim();
          const [url, ...descriptors] = trimmed.split(/\s+/);
          
          if (!url) return trimmed;
          
          const fixedUrl = fixUrl(url);
          return descriptors.length > 0 
            ? [fixedUrl, ...descriptors].join(' ')
            : fixedUrl;
        });
        return `srcset="${parts.join(', ')}"`;
      }
    );

    // Response-Header anpassen
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('Frame-Options');
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');
    
    if (!newHeaders.has('Content-Type')) {
      newHeaders.set('Content-Type', contentType);
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    
  } else {
    // Nicht-HTML/CSS/JS Inhalte
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('Frame-Options');
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
