// Cloudflare Worker: Enhanced Auth-CORS Proxy with Iframe Support
// Fixed version for all resource requests

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

  // Check if this is a direct resource request (path starts with /_next, /static, etc.)
  const isDirectResourceRequest = url.pathname.startsWith('/_next') || 
                                  url.pathname.startsWith('/static') ||
                                  url.pathname.startsWith('/images') ||
                                  url.pathname.startsWith('/assets') ||
                                  url.pathname.startsWith('/favicon.ico') ||
                                  url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/);

  let targetUrl;
  
  if (isDirectResourceRequest) {
    // Für direkte Resource-Requests: Verwende den Referer um die originale Domain zu finden
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        // Extrahiere die originale Ziel-URL aus dem Referer Query Parameter
        const originalTarget = decodeURIComponent(refererUrl.searchParams.get('url') || refererUrl.search.slice(1));
        
        if (originalTarget && originalTarget.startsWith('http')) {
          const baseUrl = new URL(originalTarget);
          // Konstruiere die vollständige URL für die Resource
          targetUrl = new URL(url.pathname + url.search, baseUrl.origin);
        } else {
          return new Response("Cannot determine target URL from referer", { status: 400 });
        }
      } catch (err) {
        return new Response("Invalid referer URL: " + err.message, { status: 400 });
      }
    } else {
      return new Response("No referer header for resource request", { status: 400 });
    }
  } else {
    // Normale Proxy-Anfrage mit Query Parameter
    const target = url.searchParams.get('url') || decodeURIComponent(url.search.slice(1));
    
    if (!target || !target.startsWith("http")) {
      return new Response(
        "Usage:\n  https://dein-worker.workers.dev/?url=https://ziel-url.com\n\nFor resources: Automatically uses referer to construct full URL",
        { status: 400, headers: { "Content-Type": "text/plain" } }
      );
    }
    targetUrl = new URL(target);
  }

  // Ursprüngliche Headers übernehmen
  const headers = new Headers(request.headers);
  
  // Origin und Referer Header für die Zielseite anpassen
  headers.delete("Origin");
  headers.delete("Referer");
  
  // Setze korrekten Host header
  headers.set("Host", targetUrl.host);

  // Eigene Header erzwingen
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  
  // User-Agent setzen
  headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
  
  // Authorization Header falls Token vorhanden und nicht für Ressourcen
  if (token && !isDirectResourceRequest) {
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
  
  if (contentType.includes("text/html") && !isDirectResourceRequest) {
    // HTML Inhalt - relative URLs korrigieren
    let body = await response.text();
    
    // Base URL für alle relativen Links setzen
    const baseHref = `<base href="${targetUrl.origin}/">`;
    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head>${baseHref}`);
    } else if (body.includes('<head ')) {
      body = body.replace(/<head[^>]*>/, `$&${baseHref}`);
    }
    
    // Alle relativen URLs in absolute URLs umwandeln, die durch den Proxy gehen
    const proxyBase = `${url.origin}/?url=`;
    
    // href, src, action attributes
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        // Für bekannte Resource-Pfade, durch den Proxy leiten
        if (path.startsWith('/_next/') || path.startsWith('/static/') || path.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
          return `${attr}="${proxyBase}${encodeURIComponent(targetUrl.origin + path)}"`;
        }
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
        const fullPath = targetUrl.origin + basePath + path;
        
        // Für bekannte Resource-Typen durch Proxy leiten
        if (path.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
          return `${attr}="${proxyBase}${encodeURIComponent(fullPath)}"`;
        }
        return `${attr}="${fullPath}"`;
      }
    );

    // CSS URLs in HTML korrigieren
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      (match, path) => {
        return `url("${proxyBase}${encodeURIComponent(targetUrl.origin + path)}")`;
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
    
  } else if (contentType.includes("text/css") && !isDirectResourceRequest) {
    // CSS Dateien - URLs korrigieren
    let body = await response.text();
    const proxyBase = `${url.origin}/?url=`;
    
    // Relative URLs in CSS
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      (match, path) => {
        return `url("${proxyBase}${encodeURIComponent(targetUrl.origin + path)}")`;
      }
    );
    
    body = body.replace(
      /url\(['"]?((?!https?:\/\/|data:)([^)'"]*))['"]?\)/gi,
      (match, path) => {
        if (path.startsWith('/')) return match;
        const basePath = targetUrl.pathname.endsWith('/') ? targetUrl.pathname : 
                         targetUrl.pathname.split('/').slice(0, -1).join('/') + '/';
        return `url("${proxyBase}${encodeURIComponent(targetUrl.origin + basePath + path)}")`;
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
    // Andere Content-Types (JSON, Bilder, JS, etc.) - Direkte Antwort
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
