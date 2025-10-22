// Cloudflare Worker: Auth-CORS Proxy
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter und hängt automatisch
// die Header "Authorization" und "Accept" an.
// Aufruf: https://dein-worker.workers.dev/?https://ziel-url.com/pfad

// ⚙️ Dein API Token hier eintragen:
const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtyRU03TTJKZDY5NWZRZ3dsOG4tYyJ9.eyJodHRwczovL21hcmluZXRyYWZmaWMuY29tL3VzZXJJZCI6Nzk1ODk3OCwiaHR0cHM6Ly9tYXJpbmV0cmFmZmljLmNvbS9lbWFpbCI6InNjaHVsemVlbnJpY28yMTRAZ21haWwuY29tIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmtwbGVyLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDEwMjA5Nzk2MTIzNDc1NjQyOTkzMSIsImF1ZCI6WyJodHRwczovL21hcmluZXRyYWZmaWMuY29tIiwiaHR0cHM6Ly9rcGxlci1wcm9kLmV1LmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjExNzI0MzgsImV4cCI6MTc2MTE3MzAzOCwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCBvZmZsaW5lX2FjY2VzcyIsImF6cCI6IkQyRmg2cFlpWUFTYWhNdE1XNXhTYWhFclpCa0xmMTF3In0.EikUqKLWqjdG6TXnaHdfBLlNu1q8kLFJzRuS-CERTcwSTWBrvrQHI5nx0G1JAEy67uLFf1Le7S2R3Kxhh-HyuTizn7MIjxXeKmjj5Mckk96W4gg1Ze-nETdIXzUc0VrI3ZONOKRUJSDrL37cP2-OKbQUbvp5apaU6soaYj6Z4u7lPOuKCLW7_uS5mFANgj5egofo8umOWk2VyXjfZnkOTIpN1ZnSGBYw23wEK9_hGWXJKMsHixf43qEvzkJRdeu6NbrD002L0XqLvJjROcwrR6c8WU8PjkLNQJUzrwSC00Xrhro69XEDREBqBDkBnAWHEKqv6AozwZECUTaT3aW9tA"; // z. B. eyJhbGciOi...

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const target = decodeURIComponent(url.search.slice(1));

  if (!target || !target.startsWith("http")) {
    return new Response(
      "Usage:\n  https://dein-worker.workers.dev/?https://ziel-url.com/api\n",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Ursprüngliche Headers übernehmen
  const headers = new Headers(request.headers);

  // Eigene Header erzwingen
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  // Request an Ziel weiterleiten
  const init = {
    method: request.method,
    headers,
    body:
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body
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

  // CORS-Header hinzufügen
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
  };

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
