// Cloudflare Worker: Simplified Root-based URL resolver
const token = "nG6o2LHug8Sbqo2dy7MdE1T1OHzobu5d";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  
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
      "Usage: https://dein-worker.workers.dev/?https://ziel-url.com\n\nFeatures:\n- Removes security headers\n- Fixes URLs to root\n- CORS enabled",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  const targetUrl = new URL(target);
  
  // Headers
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.delete("Referer");
  headers.set("Accept", "*/*");
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Fetch
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

  const contentType = response.headers.get("content-type") || "";
  
  // Nur HTML, CSS, JS transformieren
  if (contentType.includes("text/html") || contentType.includes("text/css") || 
      contentType.includes("javascript") || contentType.includes("application/javascript")) {
    
    let body = await response.text();
    const origin = targetUrl.origin; // z.B. "https://www.maersk.com"
    
    // EINFACHE LOGIK: ALLE Pfade vom Root auflösen
    const fixAllUrls = (urlString) => {
      // Ignoriere bereits vollständige URLs und spezielle URLs
      if (urlString.startsWith('http://') || urlString.startsWith('https://') || 
          urlString.startsWith('//') || urlString.startsWith('data:') || 
          urlString.startsWith('#') || urlString.startsWith('mailto:') ||
          urlString.startsWith('tel:') || urlString.startsWith('javascript:')) {
        return urlString;
      }
      
      // Absolute Pfade (beginnen mit /)
      if (urlString.startsWith('/')) {
        return origin + urlString;
      }
      
      // Wenn es mit ./ beginnt, entferne das ./
      if (urlString.startsWith('./')) {
        return origin + '/' + urlString.substring(2);
      }
      
      // Wenn es mit ../ beginnt, vom Root auflösen (ignoriere die ..)
      if (urlString.startsWith('../')) {
        let path = urlString;
        while (path.startsWith('../')) {
          path = path.substring(3);
        }
        return origin + '/' + path;
      }
      
      // Einfache relative Pfade
      return origin + '/' + urlString;
    };
    
    // 1. Alle href, src, action Attribute
    body = body.replace(
      /(href|src|action|data-src|data-href)=["']([^"']*)["']/gi,
      (match, attr, url) => {
        return `${attr}="${fixAllUrls(url)}"`;
      }
    );
    
    // 2. CSS url()
    body = body.replace(
      /url\(['"]?([^)'"]*)['"]?\)/gi,
      (match, url) => {
        // Spezielle Werte nicht ändern
        if (url.startsWith('data:') || url.startsWith('http') || 
            url.startsWith('//') || url === 'none' || url === 'inherit' ||
            url === 'initial' || url === 'unset') {
          return match;
        }
        return `url("${fixAllUrls(url)}")`;
      }
    );
    
    // 3. srcset (für responsive Bilder)
    body = body.replace(
      /srcset=["']([^"']+)["']/gi,
      (match, srcset) => {
        const parts = srcset.split(',').map(part => {
          const trimmed = part.trim();
          const segments = trimmed.split(/\s+/);
          
          if (segments.length === 0) return trimmed;
          
          const fixedUrl = fixAllUrls(segments[0]);
          if (segments.length > 1) {
            return [fixedUrl, ...segments.slice(1)].join(' ');
          }
          return fixedUrl;
        });
        return `srcset="${parts.join(', ')}"`;
      }
    );
    
    // 4. Meta refresh und andere URLs
    body = body.replace(
      /content=["']\d+;\s*url=([^"']*)["']/gi,
      (match, url) => {
        return `content="0; url=${fixAllUrls(url)}"`;
      }
    );

    // Response Header
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
    // Binary data oder andere Typen
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
