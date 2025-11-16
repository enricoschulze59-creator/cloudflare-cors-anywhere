// Cloudflare Worker: Complete Proxy with RSC Support
// Behandelt _rsc Parameter und alle Joyn-Pfade korrekt

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

// Joyn Header Konfiguration
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
  const proxyBase = `${url.origin}/?url=`;
  const joynBase = 'https://www.joyn.de';
  
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

  // Check if this is a direct path request (starts with / but not /?url=)
  const hasDirectPath = url.pathname !== '/' && !url.search.includes('url=');
  const isJoynPath = url.pathname.startsWith('/_next') || 
                     url.pathname.startsWith('/static') ||
                     url.pathname.startsWith('/images') ||
                     url.pathname.startsWith('/assets') ||
                     url.pathname.startsWith('/play') ||
                     url.pathname.startsWith('/news') ||
                     url.pathname.startsWith('/collection') ||
                     url.pathname.startsWith('/serien') ||
                     url.pathname.startsWith('/reality') ||
                     url.pathname.startsWith('/favicon.ico') ||
                     url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/);

  const isDirectPathRequest = hasDirectPath && isJoynPath;

  let targetUrl;
  
  if (isDirectPathRequest) {
    // Für direkte Pfad-Requests: Konstruiere die komplette Joyn URL
    console.log(`Direct path request: ${url.pathname}${url.search}`);
    targetUrl = new URL(url.pathname + url.search, joynBase);
  } else {
    // Normale Proxy-Anfrage mit ?url= Parameter
    const target = url.searchParams.get('url') || decodeURIComponent(url.search.slice(1));
    
    if (!target || !target.startsWith("http")) {
      // Wenn keine URL angegeben, zeige Hilfe
      if (url.pathname === '/') {
        return new Response(
          `Joyn Proxy Worker\n\nVerwendung:\n- Mit URL Parameter: ${url.origin}/?url=https://www.joyn.de\n- Direkte Pfade: ${url.origin}/play/live-tv\n- RSC Requests: ${url.origin}/play/live-tv?_rsc=hars1\n\nUnterstützte Pfade:\n/play/*, /news, /collection/*, /serien/*, /reality, /_next/*, /static/*`,
          { status: 400, headers: { "Content-Type": "text/plain" } }
        );
      }
      return new Response("Invalid request - use ?url= parameter or direct Joyn paths", { status: 400 });
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
  const headers = new Headers();
  headers.set("Host", targetUrl.host);
  headers.set("Accept", "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  // Joyn-spezifische Header für Joyn-Domains
  const isJoynRelated = originalUrl.includes('joyn.de') || rewrittenUrl.includes('joyn_api.php');
  if (isJoynRelated) {
    // Setze alle Joyn-Header
    for (const [key, value] of Object.entries(JOYN_HEADERS)) {
      headers.set(key, value);
    }
    
    // Spezielle Header für RSC Requests
    if (url.search.includes('_rsc=')) {
      headers.set('RSC', '1');
      headers.set('Next-Router-State-Tree', '');
      headers.set('Next-Url', url.pathname);
    }
  } else {
    // Für nicht-Joyn Requests, originale Header übernehmen
    const originalHeaders = new Headers(request.headers);
    originalHeaders.forEach((value, key) => {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
  }

  if (token && !isDirectPathRequest && !isJoynRelated) {
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
    console.log(`Proxying to: ${targetUrl.toString()}`);
    response = await fetch(targetUrl.toString(), init);
  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "";
  
  // Spezielle Behandlung für RSC Responses
  if (url.search.includes('_rsc=') && response.headers.get('content-type')?.includes('text/x-component')) {
    const newHeaders = new Headers(response.headers);
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
  
  if (contentType.includes("text/html") && !isDirectPathRequest) {
    // HTML Inhalt - umfassende Modifikation
    let body = await response.text();
    
    // Base URL setzen
    const baseHref = `<base href="${joynBase}/">`;
    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head>${baseHref}`);
    } else if (body.includes('<head ')) {
      body = body.replace(/<head[^>]*>/, `$&${baseHref}`);
    }

    // 1. Alle Resource-URLs durch Proxy leiten
    body = body.replace(
      /(href|src|action)=["'](\/[^"']*)["']/gi,
      (match, attr, path) => {
        const fullUrl = joynBase + path;
        return `${attr}="${proxyBase}${encodeURIComponent(fullUrl)}"`;
      }
    );

    // 2. Relative Pfade
    body = body.replace(
      /(href|src|action)=["']((?!https?:\/\/|data:)([^"':][^"']*))["']/gi,
      (match, attr, path) => {
        if (path.startsWith('/')) return match;
        const fullUrl = joynBase + '/' + path;
        return `${attr}="${proxyBase}${encodeURIComponent(fullUrl)}"`;
      }
    );

    // 3. CSS URLs
    body = body.replace(
      /url\(['"]?(\/[^)'"]*)['"]?\)/gi,
      (match, path) => {
        const fullUrl = joynBase + path;
        return `url("${proxyBase}${encodeURIComponent(fullUrl)}")`;
      }
    );

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
    
  } else {
    // Andere Content-Types (JSON, CSS, JS, RSC, etc.)
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
