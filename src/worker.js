const ALLOWED_PREFS = new Set(['want', 'maybe', 'skip']);
const ITEM_KEY_RE = /^(do|eat):(cancun-yucatan|rio-beyond):[a-z0-9][a-z0-9-]{0,119}$/;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function authenticatedEmail(request) {
  return request.headers.get('cf-access-authenticated-user-email')?.trim().toLowerCase() || null;
}

async function getProfile(env, email) {
  if (!email) return null;
  const row = await env.DB.prepare(
    'SELECT profile FROM profiles WHERE user_email = ?'
  ).bind(email).first();
  return row?.profile || null;
}

async function allPreferences(env) {
  const result = await env.DB.prepare(`
    SELECT profiles.profile, preferences.item_key, preferences.value, preferences.updated_at
    FROM preferences
    JOIN profiles ON profiles.user_email = preferences.user_email
    ORDER BY profiles.profile, preferences.item_key
  `).all();
  return result.results || [];
}

async function requireIdentity(request, env) {
  const email = authenticatedEmail(request);
  if (!email) return { error: json({ error: 'authentication_required' }, 401) };

  const profile = await getProfile(env, email);
  if (!profile) return { error: json({ error: 'profile_not_linked' }, 403) };

  return { email, profile };
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health') {
    return json({ ok: true, app: 'cancunio', d1: Boolean(env.DB) });
  }

  const identity = await requireIdentity(request, env);
  if (identity.error) return identity.error;

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    return json({
      profile: identity.profile,
      preferences: await allPreferences(env),
    });
  }

  if (url.pathname === '/api/me' && request.method === 'GET') {
    return json({ profile: identity.profile });
  }

  if (url.pathname === '/api/preference' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const itemKey = String(body?.item_key || '');
    const value = body?.value === null ? null : String(body?.value || '');

    if (!ITEM_KEY_RE.test(itemKey)) {
      return json({ error: 'invalid_item_key' }, 400);
    }
    if (value !== null && !ALLOWED_PREFS.has(value)) {
      return json({ error: 'invalid_preference' }, 400);
    }

    if (value === null) {
      await env.DB.prepare(
        'DELETE FROM preferences WHERE user_email = ? AND item_key = ?'
      ).bind(identity.email, itemKey).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO preferences (user_email, item_key, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_email, item_key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(identity.email, itemKey, value).run();
    }

    return json({ ok: true, item_key: itemKey, value });
  }

  return json({ error: 'not_found' }, 404);
}

function notLinkedPage() {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancúnio · Account not linked</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f1;color:#142120}.box{width:min(430px,calc(100% - 32px));background:#fff;border:1px solid #e7e7df;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(20,33,32,.1)}h1{margin:0 0 8px;font-size:30px}p{color:#66706e;line-height:1.5}</style></head>
<body><main class="box"><div>↗ Cancúnio</div><h1>Account not linked</h1><p>This email passed the private login gate, but it is not linked to an Emrys or Hannah profile.</p></main></body></html>`, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function serveIndex(request, env) {
  const email = authenticatedEmail(request);
  if (!email) return new Response('Authentication required', { status: 401 });

  const profile = await getProfile(env, email);
  if (!profile) return notLinkedPage();

  const indexUrl = new URL('/index.html', request.url);
  const response = await env.ASSETS.fetch(new Request(indexUrl, request));
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname === '/') return await serveIndex(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      if (url.pathname.startsWith('/api/')) return json({ error: 'server_error' }, 500);
      return new Response('Cancúnio backend error', { status: 500 });
    }
  },
};
