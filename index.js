// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter, entfernt Sicherheitsheader
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
  
  if (contentType.includes("text/html") || contentType.includes("text/css") || contentType.includes("application/javascript")) {
    // HTML/CSS/JS Inhalt - relative URLs korrigieren
    let body = await response.text();
    
    // Helper-Funktion zum Ermitteln der Basis-URL
    const getBaseUrl = (urlString) => {
      const urlObj = new URL(urlString);
      const path = urlObj.pathname;
      
      // Wenn der Pfad ein Datei-Pfad ist (mit Erweiterung)
      const hasFileExtension = path.match(/\.(html|htm|php|asp|aspx|jsp|js|css|xml|json|txt|pdf|doc|xls|jpg|jpeg|png|gif|svg|ico)$/i);
      
      if (hasFileExtension) {
        // Gehe ein Verzeichnis zurück
        const lastSlashIndex = path.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          return `${urlObj.origin}${path.substring(0, lastSlashIndex)}/`;
        } else {
          return `${urlObj.origin}/`;
        }
      } else {
        // Ist wahrscheinlich ein Verzeichnis
        if (path.endsWith('/')) {
          return `${urlObj.origin}${path}`;
        } else {
          return `${urlObj.origin}${path}/`;
        }
      }
    };
    
    // Helper-Funktion zum Resolven von relativen URLs
    const resolveUrl = (baseUrl, relativePath) => {
      if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || 
          relativePath.startsWith('//') || relativePath.startsWith('#')) {
        return relativePath;
      }
      
      const base = new URL(baseUrl);
      
      if (relativePath.startsWith('/')) {
        // Absolute Pfade
        return `${base.origin}${relativePath}`;
      }
      
      // Relative Pfade
      let basePath = base.pathname;
      
      // Wenn basePath nicht mit / endet, gehe ein Verzeichnis zurück
      if (!basePath.endsWith('/')) {
        const lastSlashIndex = basePath.lastIndexOf('/');
        basePath = lastSlashIndex > 0 ? basePath.substring(0, lastSlashIndex + 1) : '/';
      }
      
      // ../ und ./ Pfade auflösen
      const parts = relativePath.split('/');
      const baseParts = basePath.split('/').filter(p => p !== '');
      
      for (const part of parts) {
        if (part === '..') {
          if (baseParts.length > 0) {
            baseParts.pop();
          }
        } else if (part !== '.' && part !== '') {
          baseParts.push(part);
        }
      }
      
      return `${base.origin}/${baseParts.join('/')}`;
    };
    
    const baseUrl = getBaseUrl(targetUrl.toString());
    
    // 1. Absolute Pfade (mit führendem /)
    body = body.replace(
      /(href|src|action|data-src|data-url)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        // Ignoriere URLs, die bereits vollständig sind oder mit anderen Protokollen beginnen
        if (path.match(/^(https?:)?\/\//)) {
          return match;
        }
        return `${attr}="${targetUrl.origin}${path}"`;
      }
    );
    
    // 2. Relative Pfade (ohne führendes /) - aber nicht Data URLs oder Anchors
    body = body.replace(
      /(href|src|action|data-src|data-url)=["']((?!(https?:)?\/\/|data:|#)[^"':][^"']*)["']/gi,
      (match, attr, path) => {
        // Überspringe leere Pfade oder Self-References
        if (!path || path === '.' || path === './') {
          return match;
        }
        
        const resolved = resolveUrl(baseUrl, path);
        return `${attr}="${resolved}"`;
      }
    );
    
    // 3. CSS URLs in url()
    body = body.replace(
      /url\(['"]?([^)'"]*)['"]?\)/gi,
      (match, path) => {
        // Überspringe Data URLs, absolute URLs, und spezielle Werte
        if (path.startsWith('data:') || path.startsWith('http://') || 
            path.startsWith('https://') || path.startsWith('//') ||
            path.startsWith('#') || path === 'none' || path === 'inherit') {
          return match;
        }
        
        if (path.startsWith('/')) {
          return `url("${targetUrl.origin}${path}")`;
        } else {
          const resolved = resolveUrl(baseUrl, path);
          return `url("${resolved}")`;
        }
      }
    );
    
    // 4. Spezielle Fälle: srcset in Bildern
    body = body.replace(
      /srcset=["']([^"']+)["']/gi,
      (match, srcset) => {
        const parts = srcset.split(',').map(part => {
          const trimmed = part.trim();
          const [url, descriptor] = trimmed.split(/\s+/);
          
          if (!url || url.startsWith('data:') || url.startsWith('http://') || 
              url.startsWith('https://') || url.startsWith('//')) {
            return trimmed;
          }
          
          const resolvedUrl = url.startsWith('/') 
            ? `${targetUrl.origin}${url}`
            : resolveUrl(baseUrl, url);
            
          return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl;
        });
        
        return `srcset="${parts.join(', ')}"`;
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
