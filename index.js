// Cloudflare Worker: Auth-CORS Proxy
// by ChatGPT (GPT-5)
// Funktion: Leitet Anfragen an externe APIs weiter und hängt automatisch
// die Header "Authorization" und "Accept" an.
// Aufruf: https://dein-worker.workers.dev/?https://ziel-url.com/pfad

// ⚙️ Dein API Token hier eintragen:
const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL21hcmluZXRyYWZmaWMuY29tL3VzZXJJZCI6Nzk1ODk3OCwiaHR0cHM6Ly9tYXJpbmV0cmFmZmljLmNvbS9lbWFpbCI6InNjaHVsemVlbnJpY28yMTRAZ21haWwuY29tIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmtwbGVyLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDEwMjA5Nzk2MTIzNDc1NjQyOTkzMSIsImF1ZCI6WyJodHRwczovL21hcmluZXRyYWZmaWMuY29tIiwiaHR0cHM6Ly9rcGxlci1wcm9kLmV1LmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjExNzEzMjMsImV4cCI6MTc2MTE3MTkyMywic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCBvZmZsaW5lX2FjY2VzcyIsImF6cCI6IkQyRmg2cFlpWUFTYWhNdE1XNXhTYWhFclpCa0xmMTF3In0.I2LzRgScIdx6wTH_JUPyU9-v2pqhJ7PsEAtuHprwqR6hzdTgApmoqvw5m2sjqlyqnT7L2rYFnkP1URqC_fGTBhCrnnWnpUVCERZ9Y2bl0oRj4Ohv14XGjT2VRonjioEvm3Xn-4niKOSCfnXjVRA_opCc2JXFKs5FFCgbIrxO5jMBJfXLC2vymoPUUt6xc1e-3p2xkxFWjzjh-1xVOViHHobPOfnIWW9rP-sG5H-U8BOeFEfiKtv00J2e2G4QSP1q-HMIQg9VPYoyj_1Iq2dc3CgiBEmpxsiUJuwIxiEf-iBSzQHTjYVjSVcG7vKszqQrG05PwMryqRT69icYk8rYog"; // z. B. eyJhbGciOi...

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
