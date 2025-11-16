// Cloudflare Worker: Enhanced Proxy with Joyn API Headers
// Automatically adds all required Joyn headers for API requests

// ⚙️ Dein API Token hier eintragen:
const token = "nG6o2LHug8Sbqo2dy7MdE1T1OHzobu5d";

// Joyn API Headers Konfiguration
const JOYN_HEADERS = {
  'accept': '*/*',
  'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImEwZDQwYjkxZTA2OGEzY2ZhODQ1ZjRkZTViNmY3NjA2NmEzMzc3NTEifQ.eyJqSWQiOiJERVBSRUNBVEVEIiwiaklkQyI6IkpOQUEtZTNkYmUwYjYtMGFiNi01ZGE2LWI0MGEtNmRiZjYzMGMzM2M2IiwicElkQyI6IkRFUFJFQ0FURUQiLCJjSWQiOiJkYjc5MWM4Zi0zOTA0LTQ5OWMtOWIzYi00YjE0MjM5YTM3ZDQiLCJpbnRlcm5hbCI6ZmFsc2UsImVsaWdpYmxlRm9yRW1wbG95ZWVTdWJzY3JpcHRpb24iOmZhbHNlLCJkaXN0cmlidXRpb25fdGVuYW50IjoiSk9ZTiIsImlhdCI6MTc2MjU1NTAzMywiZXhwIjoxNzYyNjQxNDMzLCJhdWQiOlsid2ViIl0sImlzcyI6Imh0dHBzOi8vYXV0aC5qb3luLmRlIiwic3ViIjoiZTIzMDM3N2QtOTg1ZS00MTg1LTg1MmItMzVjYWUyYzRjNmRkIn0.PIZaMlVQ2j614D38ieIS4NxGquIpoiKhb0LBQ8vr7PBjUj_-1iT9Tdutc93YMTNEWzbWuyQiGGuN3kR22xO47I4j3gnsIhT5IvAIt2EKd4WG1nCxrZGsxlhXZfFspp7sJ_heIhhYF407nQqv_aAP72E3fISAoF6HzxUTyiOsHRKxgz9sHme5f2KUaHfPhUYdVIB2bWBmYlsnliI-y--elDnsIB-0nHFzh5c8X8iSjQ0RKVWR5oTqfaTuYpMTH7nnLokjx3KNiiwbjAEuWV5-c3iwaSbXJ5JNtJgZ2fIu7ShWR81mD4JoEqVph0VOKGfSVcJGxVgyuKBJHXfPvaVEy24m9e3NrtSHcn-JiewmBbVMe7i2MtRTF1YkTY-kbTPXJaOerC5UFq7Km5m6plGtk42d3o6mzdumKEUhv1TzVg7PTTJUygztipBmCa9lT8CJ9KdaLFUtHPChSU69j_3-9uSSQAZv8vkZZlbALzi6hqzoRHdmgm3Wtvc_hsD7GB1Zqj4du5C9Gv4at6Frr4b7hZLAANqS38s-Xk9SKAiTAZ1LU2ASAypDqzTS18TFM5Le-NhobGFd5R1RbHbcS2rBAXnFYgMajSmwyTBfcOndhUNUozqbK9fiA5y6SffNEldMmDek3ZXkec7UPM_7pVYjicVqyIuIHtBuGZ9Kn3LGFTs',
  'content-type': 'application/json',
  'joyn-client-version': '5.1313.0',
  'joyn-country': 'DE',
  'joyn-distribution-tenant': 'JOYN',
  'joyn-platform': 'web',
  'joyn-user-state': 'code=A_A',
  'origin': 'https://www.joyn.de',
  'priority': 'u=1, i',
  'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'x-api-key': '4f0fd9f18abbe3cf0e87fdb556bc39c8'
};

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
        "Usage:\n  https://dein-worker.workers.dev/?url=https://ziel-url.com\n\nEnhanced Proxy with Joyn API headers",
        { status: 400, headers: { "Content-Type": "text/plain" } }
      );
    }
    targetUrl = new URL(target);
  }

  // Request vorbereiten
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.delete("Referer");
  headers.set("Host", targetUrl.host);
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");

  // Joyn API Headers hinzufügen für Joyn-Domains
  const isJoynDomain = targetUrl.hostname.includes('joyn.de') || 
                       targetUrl.hostname.includes('auth.joyn.de') ||
                       targetUrl.hostname.includes('api.joyn.de');

  if (isJoynDomain) {
    // Alle Joyn-Header hinzufügen
    for (const [key, value] of Object.entries(JOYN_HEADERS)) {
      headers.set(key, value);
    }
    
    // Speziell für Auth-Endpoints
    if (targetUrl.pathname.includes('/auth/')) {
      headers.set('content-type', 'application/json');
    }
  } else {
    // Standard User-Agent für andere Domains
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  }

  if (token && !isDirectResourceRequest && !isJoynDomain) {
    headers.set("Authorization", `Bearer ${token}`);
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

    // 4. JavaScript patchen für History API Probleme
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
