/**
 * One-shot header/metadata probe against a running server.
 *
 * The earlier version of this script was a hanging REPL (it read stdin), so it
 * never returned. It now fetches a fixed list of routes, prints what matters and
 * exits — `node scripts/probe-headers.mjs [origin]`.
 */
const ORIGIN = process.argv[2] || 'http://127.0.0.1:3000';

const ROUTES = [
  '/',
  '/about',
  '/help',
  '/cookies',
  '/privacy',
  '/terms',
  '/dashboard',
  '/api/barcode/lookup?code=12345',
  '/api/household-invitations',
  '/offline.html',
];

const INTERESTING = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'cache-control',
  'vary',
];

function titleOf(html) {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '(none)';
}
function canonicalOf(html) {
  return /<link rel="canonical" href="([^"]*)"/i.exec(html)?.[1] ?? '(none)';
}
function hreflangOf(html) {
  return [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)"/gi)].map((m) => m[1]);
}
function ldJsonTypes(html) {
  // Attribute order is not stable across renderers (the app's own <JsonLd>
  // emits `id` before `type`), so match the tag by its type attribute anywhere.
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) ? parsed.map((n) => n['@type']).join('+') : parsed['@type'];
    } catch {
      return '(unparseable)';
    }
  });
}

const results = [];
for (const route of ROUTES) {
  const method = route === '/api/household-invitations' ? 'POST' : 'GET';
  try {
    const res = await fetch(ORIGIN + route, {
      method,
      headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
      body: method === 'POST' ? '{}' : undefined,
      redirect: 'manual',
    });
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('text/html') ? await res.text() : await res.text();
    const headers = {};
    for (const key of INTERESTING) {
      const value = res.headers.get(key);
      if (value) headers[key] = value;
    }
    results.push({
      route,
      status: res.status,
      headers,
      title: contentType.includes('text/html') ? titleOf(body) : undefined,
      canonical: contentType.includes('text/html') ? canonicalOf(body) : undefined,
      hreflang: contentType.includes('text/html') ? hreflangOf(body) : undefined,
      jsonLd: contentType.includes('text/html') ? ldJsonTypes(body) : undefined,
      body: contentType.includes('application/json') ? body.slice(0, 200) : undefined,
    });
  } catch (error) {
    results.push({ route, error: String(error) });
  }
}

console.log(JSON.stringify(results, null, 2));
