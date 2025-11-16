// Cloudflare Worker: Complete Proxy with URL Rewriting
// Beinhaltet ALLE Funktionen + Joyn API Rewriting

const token = "nG6o2LHug8Sbqo2dy7MdE1T1OHzobu5d";

// Konfiguration für URL-Rewriting
const REWRITE_RULES = [
  {
    from: 'api.joyn.de/graphql',
    to: 'tv-livestream.live/joyn_api.php/graphql'
  },
  {
    from: 'auth.joyn.de',
    to: 'tv-livestream.live/joyn_api.php/auth'
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

  // Check if this is a direct resource request
  const isDirectResourceRequest = url.pathname.startsWith('/_next') || 
                                  url.pathname.startsWith('/static') ||
                                  url.pathname.startsWith('/images') ||
                                  url.pathname.startsWith('/assets') ||
                                  url.pathname.startsWith('/favicon.ico') ||
                                  url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/);

  let targetUrl;
  
  if (isDirectResourceRequest) {
    // Für direkte Resource-Requests
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const originalTarget = decodeURIComponent(refererUrl.searchParams.get('url') || refererUrl.search.slice(1));
        
        if (originalTarget && originalTarget.startsWith('http')) {
          const baseUrl = new URL(originalTarget);
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
    // Normale Proxy-Anfrage
    const target = url.searchParams.get('url') || decodeURIComponent(url.search.slice(1));
    
    if (!target || !target.startsWith("http")) {
      return new Response(
        "Usage:\n  https://dein-worker.workers.dev/?url=https://ziel-url.com\n\nComplete Proxy with URL Rewriting",
        { status: 400, headers: { "Content-Type": "text/plain" } }
      );
    }
    targetUrl = new URL(target);
  }

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
  headers.delete("Origin");
  headers.delete("Referer");
  headers.set("Host", targetUrl.host);
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  if (token && !isDirectResourceRequest) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Joyn-spezifische Header für Joyn-Domains
  const isJoynRelated = originalUrl.includes('joyn.de') || rewrittenUrl.includes('joyn_api.php');
  if (isJoynRelated) {
    headers.set('content-type', 'application/json');
    headers.set('x-api-key', '4f0fd9f18abbe3cf0e87fdb556bc39c8');
    headers.set('joyn-platform', 'web');
    headers.set('joyn-country', 'DE');
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
    response = await fetch(targetUrl.toString(), init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "";
  
  if (contentType.includes("text/html") && !isDirectResourceRequest) {
    // HTML Inhalt - umfassende Modifikation
    let body = await response.text();
    
    // Base URL setzen
    const baseHref = `<base href="${targetUrl.origin}/">`;
    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head>${baseHref}`);
    } else if (body.includes('<head ')) {
      body = body.replace(/<head[^>]*>/, `$&${baseHref}`);
    }

    // Proxy Base URL
    const proxyBase = `${url.origin}/?url=`;
    
    // 1. Alle Resource-URLs durch Proxy leiten
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        const fullUrl = targetUrl.origin + path;
        return `${attr}="${proxyBase}${encodeURIComponent(fullUrl)}"`;
      }
    );

    // 2. Relative Pfade
    body = body.replace(
      /(href|src|action)=["']((?!https?:\/\/|data:)([^"':][^"']*))["']/gi,
      (match, attr, path) => {
        if (path.startsWith('/')) return match;
        const basePath = targetUrl.pathname.endsWith('/') ? targetUrl.pathname : 
                         targetUrl.pathname.split('/').slice(0, -1).join('/') + '/';
        const fullUrl = targetUrl.origin + basePath + path;
        return `${attr}="${proxyBase}${encodeURIComponent(fullUrl)}"`;
      }
    );

    // 3. CSS URLs
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      (match, path) => {
        const fullUrl = targetUrl.origin + path;
        return `url("${proxyBase}${encodeURIComponent(fullUrl)}")`;
      }
    );

    // 4. JavaScript patchen
    body = body.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      (match) => {
        if (match.includes('src=')) {
          return match.replace(
            /src=["']([^"']*)["']/gi,
            (srcMatch, srcPath) => {
              if (srcPath.startsWith('http')) {
                return srcMatch;
              }
              const fullUrl = srcPath.startsWith('/') ? targetUrl.origin + srcPath : 
                             targetUrl.origin + '/' + srcPath;
              return `src="${proxyBase}${encodeURIComponent(fullUrl)}"`;
            }
          );
        }
        return match;
      }
    );

    // 5. Meta Tags für Security anpassen
    body = body.replace(
      /<meta[^>]*content-security-policy[^>]*>/gi,
      '' // CSP entfernen
    );

    // 6. Window.name Script injizieren um Origin Probleme zu lösen
    const fixScript = `
    <script>
    // Fix für History API und Origin Probleme
    (function() {
      // Proxy für History API
      const originalReplaceState = history.replaceState;
      const originalPushState = history.pushState;
      
      history.replaceState = function(state, title, url) {
        try {
          return originalReplaceState.call(this, state, title, url);
        } catch (e) {
          console.warn('History API blocked:', e);
          return originalReplaceState.call(this, state, title, undefined);
        }
      };
      
      history.pushState = function(state, title, url) {
        try {
          return originalPushState.call(this, state, title, url);
        } catch (e) {
          console.warn('History API blocked:', e);
          return originalPushState.call(this, state, title, undefined);
        }
      };
      
      // Fetch API wrapper für CORS
      const originalFetch = window.fetch;
      window.fetch = function(resource, init) {
        if (typeof resource === 'string' && !resource.startsWith('${url.origin}')) {
          // Durch Proxy leiten
          const proxyUrl = '${proxyBase}' + encodeURIComponent(resource);
          return originalFetch.call(this, proxyUrl, init);
        }
        return originalFetch.call(this, resource, init);
      };
      
      // XMLHttpRequest wrapper
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url && !url.startsWith('${url.origin}') && !url.startsWith('blob:') && !url.startsWith('data:')) {
          // Durch Proxy leiten
          url = '${proxyBase}' + encodeURIComponent(url);
        }
        return originalXHROpen.call(this, method, url, async, user, password);
      };
    })();
    </script>
    `;

    // Fix Script in head einfügen
    body = body.replace('</head>', `${fixScript}</head>`);

    // Response erstellen
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
    
  } else if (contentType.includes("text/css") && !isDirectResourceRequest) {
    // CSS Dateien
    let body = await response.text();
    const proxyBase = `${url.origin}/?url=`;
    
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
    
  } else if (contentType.includes("application/javascript") && !isDirectResourceRequest) {
    // JavaScript Dateien - CORS Fehler beheben
    let body = await response.text();
    
    // Fetch API calls patchen
    body = body.replace(
      /fetch\((['"])(https?:\/\/[^'"]+)\1/gi,
      (match, quote, fetchUrl) => {
        return `fetch(${quote}${url.origin}/?url=${encodeURIComponent(fetchUrl)}${quote}`;
      }
    );
    
    // XMLHttpRequest patchen
    body = body.replace(
      /\.open\((['"])(GET|POST|PUT|DELETE|PATCH)\1\s*,\s*(['"])(https?:\/\/[^'"]+)\3/gi,
      (match, methodQuote, method, urlQuote, xhrUrl) => {
        return `.open(${methodQuote}${method}${methodQuote}, ${urlQuote}${url.origin}/?url=${encodeURIComponent(xhrUrl)}${urlQuote}`;
      }
    );

    const newHeaders = new Headers(response.headers);
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Content-Type', 'application/javascript');

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    
  } else {
    // Andere Content-Types
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
