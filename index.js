// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter, entfernt Sicherheitsheaders
// und korrigiert relative URLs für iframe-Einbettung

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
    
    // Basis-URL für relative Pfade extrahieren
    const getBasePath = (url) => {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // Wenn die URL auf eine Datei endet (mit Erweiterung), gehe ein Verzeichnis zurück
      if (path.includes('.')) {
        const lastSlashIndex = path.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          return path.substring(0, lastSlashIndex + 1);
        }
      }
      // Andernfalls, wenn die URL auf einen Slash endet, behalte sie
      return path.endsWith('/') ? path : path + '/';
    };
    
    const basePath = getBasePath(targetUrl.toString());
    const baseUrl = targetUrl.origin + basePath;
    
    console.log('Target URL:', targetUrl.toString());
    console.log('Base path:', basePath);
    console.log('Base URL:', baseUrl);
    
    // Korrektur für absolute Pfade (mit führendem /)
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        // Für absolute Pfade einfach die Origin verwenden
        return `${attr}="${targetUrl.origin}${path}"`;
      }
    );
    
    // Korrektur für relative Pfade (ohne führendes /)
    body = body.replace(
      /(href|src|action)=["']((?!(https?:)?\/\/)[^"':][^"']*)["']/gi,
      (match, attr, path) => {
        // Wenn der Pfad bereits mit http:// oder https:// beginnt, unverändert lassen
        if (path.startsWith('http://') || path.startsWith('https://')) {
          return match;
        }
        
        // Für relative Pfade die Basis-URL verwenden
        if (path.startsWith('./')) {
          // ./file.js -> baseUrl + file.js
          return `${attr}="${baseUrl}${path.substring(2)}"`;
        } else if (path.startsWith('../')) {
          // Komplexe Logik für ../ Pfade
          let relativePath = path;
          let currentBase = basePath;
          
          while (relativePath.startsWith('../')) {
            // Ein Verzeichnis zurück gehen
            currentBase = currentBase.substring(0, currentBase.lastIndexOf('/', currentBase.length - 2)) + '/';
            relativePath = relativePath.substring(3);
          }
          
          return `${attr}="${targetUrl.origin}${currentBase}${relativePath}"`;
        } else if (!path.startsWith('/')) {
          // Einfache relative Pfade
          return `${attr}="${baseUrl}${path}"`;
        }
        
        return match;
      }
    );

    // CSS URLs korrigieren
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      (match, path) => {
        return `url("${targetUrl.origin}${path}")`;
      }
    );
    
    // CSS relative URLs
    body = body.replace(
      /url\(['"]?((?!(https?:)?\/\/)[^)'"]*)['"]?\)/gi,
      (match, path) => {
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('#')) {
          return match;
        }
        
        if (path.startsWith('/')) {
          return `url("${targetUrl.origin}${path}")`;
        } else {
          return `url("${baseUrl}${path}")`;
        }
      }
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
