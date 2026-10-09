const ALLOWED_PREFS = new Set(['want', 'maybe', 'skip']);
const ALLOWED_PROFILES = new Set(['emrys', 'hannah']);
const ITEM_KEY_RE = /^(do|eat):(cancun-yucatan|rio-beyond):[a-z0-9][a-z0-9-]{0,119}$/;

const HERO_IMAGES = {
  '/hero/cancun.jpg': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Cancun_beach_aerial_-_Luftbild_%2818632395003%29.jpg/1280px-Cancun_beach_aerial_-_Luftbild_%2818632395003%29.jpg',
  '/hero/rio.jpg': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Rio-panorama-Botafogo-Sugarloaf.jpg/1280px-Rio-panorama-Botafogo-Sugarloaf.jpg',
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function authenticatedEmail(request) {
  return normalizeEmail(request.headers.get('cf-access-authenticated-user-email')) || null;
}

function configuredProfile(env, email) {
  if (!email) return null;
  const emrysEmail = normalizeEmail(env.EMRYS_EMAIL);
  const hannahEmail = normalizeEmail(env.HANNAH_EMAIL);
  if (emrysEmail && email === emrysEmail) return 'emrys';
  if (hannahEmail && email === hannahEmail) return 'hannah';
  return null;
}

function identityConfigStatus(env) {
  const emrysEmail = normalizeEmail(env.EMRYS_EMAIL);
  const hannahEmail = normalizeEmail(env.HANNAH_EMAIL);
  return {
    configured: Boolean(emrysEmail && hannahEmail && emrysEmail !== hannahEmail),
    emrys: Boolean(emrysEmail),
    hannah: Boolean(hannahEmail),
    distinct: Boolean(emrysEmail && hannahEmail && emrysEmail !== hannahEmail),
  };
}

async function ensurePreferenceStore(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS profile_preferences (
      profile TEXT NOT NULL CHECK (profile IN ('emrys','hannah')),
      item_key TEXT NOT NULL,
      value TEXT NOT NULL CHECK (value IN ('want','maybe','skip')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (profile, item_key)
    )
  `).run();

  // One-way compatibility import from the old email/profile schema.
  // DO NOTHING ensures stale legacy rows can never overwrite newer decisions.
  await env.DB.prepare(`
    INSERT INTO profile_preferences (profile, item_key, value, updated_at)
    SELECT profiles.profile, preferences.item_key, preferences.value, preferences.updated_at
    FROM preferences
    JOIN profiles ON profiles.user_email = preferences.user_email
    WHERE profiles.profile IN ('emrys','hannah')
    ON CONFLICT(profile, item_key) DO NOTHING
  `).run();
}

async function allPreferences(env) {
  await ensurePreferenceStore(env);
  const result = await env.DB.prepare(`
    SELECT profile, item_key, value, updated_at
    FROM profile_preferences
    ORDER BY profile, item_key
  `).all();
  return result.results || [];
}

function requireIdentity(request, env) {
  const email = authenticatedEmail(request);
  if (!email) return { error: json({ error: 'authentication_required' }, 401) };

  const profile = configuredProfile(env, email);
  if (!profile) return { error: json({ error: 'email_not_configured' }, 403) };

  return { email, profile };
}

async function serveHero(url) {
  const source = HERO_IMAGES[url.pathname];
  if (!source) return new Response('Hero image not found', { status: 404 });

  const upstream = await fetch(source, {
    headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
  });

  if (!upstream.ok) {
    console.error('Hero image upstream failed', url.pathname, upstream.status);
    return new Response('Hero image unavailable', { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return new Response(upstream.body, { status: 200, headers });
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health') {
    const config = identityConfigStatus(env);
    return json({
      ok: true,
      app: 'cancunio',
      d1: Boolean(env.DB),
      identity_configured: config.configured,
      identity_version: 2,
    });
  }

  const identity = requireIdentity(request, env);
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

  if (url.pathname === '/api/identity-status' && request.method === 'GET') {
    const config = identityConfigStatus(env);
    return json({
      ok: true,
      profile: identity.profile,
      configured_profiles: {
        emrys: config.emrys,
        hannah: config.hannah,
      },
      distinct_emails: config.distinct,
      identity_version: 2,
      legacy_profile_gate: false,
    });
  }

  if (url.pathname === '/api/preference' && request.method === 'POST') {
    await ensurePreferenceStore(env);

    const body = await request.json().catch(() => null);
    const itemKey = String(body?.item_key || '');
    const value = body?.value === null ? null : String(body?.value || '');

    if (!ITEM_KEY_RE.test(itemKey)) {
      return json({ error: 'invalid_item_key' }, 400);
    }
    if (value !== null && !ALLOWED_PREFS.has(value)) {
      return json({ error: 'invalid_preference' }, 400);
    }
    if (!ALLOWED_PROFILES.has(identity.profile)) {
      return json({ error: 'invalid_profile' }, 500);
    }

    if (value === null) {
      await env.DB.prepare(
        'DELETE FROM profile_preferences WHERE profile = ? AND item_key = ?'
      ).bind(identity.profile, itemKey).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO profile_preferences (profile, item_key, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(profile, item_key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(identity.profile, itemKey, value).run();
    }

    return json({ ok: true, item_key: itemKey, value });
  }

  return json({ error: 'not_found' }, 404);
}

function notConfiguredPage() {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancúnio · Email not configured</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f1;color:#142120}.box{width:min(430px,calc(100% - 32px));background:#fff;border:1px solid #e7e7df;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(20,33,32,.1)}h1{margin:0 0 8px;font-size:30px}p{color:#66706e;line-height:1.5}</style></head>
<body><main class="box"><div>↗ Cancúnio</div><h1>Email not configured</h1><p>This email passed the private login gate, but it is not one of the two configured Cancúnio identities.</p></main></body></html>`, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function serveIndex(request, env) {
  const identity = requireIdentity(request, env);
  if (identity.error) {
    const status = identity.error.status;
    if (status === 401) return new Response('Authentication required', { status: 401 });
    return notConfiguredPage();
  }

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
      if (HERO_IMAGES[url.pathname]) return await serveHero(url);
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
