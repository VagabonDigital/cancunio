const ALLOWED_PROFILES = new Set(['emrys', 'hannah']);
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

async function ensureSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS profiles (
        user_email TEXT PRIMARY KEY,
        profile TEXT NOT NULL UNIQUE CHECK (profile IN ('emrys','hannah')),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS preferences (
        user_email TEXT NOT NULL,
        item_key TEXT NOT NULL,
        value TEXT NOT NULL CHECK (value IN ('want','maybe','skip')),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, item_key),
        FOREIGN KEY (user_email) REFERENCES profiles(user_email) ON DELETE CASCADE
      )
    `),
  ]);
}

async function getProfile(env, email) {
  const row = await env.DB.prepare('SELECT profile FROM profiles WHERE user_email = ?').bind(email).first();
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

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health') {
    return json({ ok: true, app: 'cancunio', d1: Boolean(env.DB) });
  }

  const email = authenticatedEmail(request);
  if (!email) return json({ error: 'authentication_required' }, 401);

  await ensureSchema(env);

  if (url.pathname === '/api/me' && request.method === 'GET') {
    return json({ email, profile: await getProfile(env, email) });
  }

  if (url.pathname === '/api/profile' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const profile = String(body?.profile || '').toLowerCase();
    if (!ALLOWED_PROFILES.has(profile)) return json({ error: 'invalid_profile' }, 400);

    try {
      await env.DB.prepare(`
        INSERT INTO profiles (user_email, profile, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_email) DO UPDATE SET
          profile = excluded.profile,
          updated_at = CURRENT_TIMESTAMP
      `).bind(email, profile).run();
      return json({ ok: true, email, profile });
    } catch (error) {
      if (String(error?.message || error).toLowerCase().includes('unique')) {
        return json({ error: 'profile_already_claimed' }, 409);
      }
      throw error;
    }
  }

  if (url.pathname === '/api/preferences' && request.method === 'GET') {
    const profile = await getProfile(env, email);
    if (!profile) return json({ error: 'profile_required' }, 409);
    return json({ profile, preferences: await allPreferences(env) });
  }

  if (url.pathname === '/api/preferences/sync' && request.method === 'POST') {
    const profile = await getProfile(env, email);
    if (!profile) return json({ error: 'profile_required' }, 409);

    const body = await request.json().catch(() => null);
    const incoming = Array.isArray(body?.preferences) ? body.preferences : null;
    if (!incoming || incoming.length > 200) return json({ error: 'invalid_preferences' }, 400);

    const clean = [];
    const seen = new Set();
    for (const pref of incoming) {
      const itemKey = String(pref?.item_key || '');
      const value = String(pref?.value || '');
      if (!ITEM_KEY_RE.test(itemKey) || !ALLOWED_PREFS.has(value) || seen.has(itemKey)) {
        return json({ error: 'invalid_preferences' }, 400);
      }
      seen.add(itemKey);
      clean.push({ itemKey, value });
    }

    const statements = [env.DB.prepare('DELETE FROM preferences WHERE user_email = ?').bind(email)];
    for (const pref of clean) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO preferences (user_email, item_key, value, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(email, pref.itemKey, pref.value)
      );
    }
    await env.DB.batch(statements);
    return json({ ok: true, profile, count: clean.length });
  }

  return json({ error: 'not_found' }, 404);
}

function claimPage(email) {
  const safeEmail = email.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CANCÚNIO · First sign-in</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f1;color:#142120}.box{width:min(430px,calc(100% - 32px));background:#fff;border:1px solid #e7e7df;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(20,33,32,.1)}h1{margin:0 0 8px;font-size:30px}p{color:#66706e;line-height:1.5}.buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}button{border:0;border-radius:14px;padding:14px;font:inherit;font-weight:800;cursor:pointer;background:#142120;color:#fff}.small{font-size:12px;margin-top:18px}#msg{color:#b42318}</style></head>
<body><main class="box"><div>↗ CANCÚNIO</div><h1>Who are you?</h1><p>First sign-in only. Pick your name and this email becomes your CANCÚNIO identity.</p><div class="buttons"><button onclick="claim('emrys')">Emrys</button><button onclick="claim('hannah')">Hannah</button></div><p class="small">Signed in as ${safeEmail}</p><p id="msg"></p></main>
<script>async function claim(profile){const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile})});if(r.ok){location.href='/';return;}const d=await r.json().catch(()=>({}));document.getElementById('msg').textContent=d.error==='profile_already_claimed'?'That name is already linked to the other email.':'Could not save that profile.';}</script></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function bootstrapScript(profile, rows) {
  const serverPrefs = {};
  for (const row of rows) {
    serverPrefs[`${row.profile}:${row.item_key}`] = row.value;
  }

  const profileJson = JSON.stringify(profile);
  const prefsJson = JSON.stringify(serverPrefs).replace(/</g, '\\u003c');

  return `<style>.profile-switch{display:none!important}</style><script>(function(){
    const PROFILE=${profileJson};
    const SERVER_PREFS=${prefsJson};
    const originalSetItem=Storage.prototype.setItem;
    const migrationKey='cr-d1-migrated:'+PROFILE;
    let legacy={};
    try{legacy=JSON.parse(localStorage.getItem('cr-prefs')||'{}')||{};}catch{}
    const migrated=localStorage.getItem(migrationKey)==='1';
    const merged={...SERVER_PREFS};
    if(!migrated){
      const prefix=PROFILE+':';
      for(const [k,v] of Object.entries(legacy)){
        if(k.startsWith(prefix)&&['want','maybe','skip'].includes(v)) merged[k]=v;
      }
    }
    originalSetItem.call(localStorage,'cr-profile',PROFILE);
    originalSetItem.call(localStorage,'cr-prefs',JSON.stringify(merged));
    function ownPrefs(obj){
      const out=[]; const prefix=PROFILE+':';
      for(const [k,v] of Object.entries(obj||{})){
        if(k.startsWith(prefix)&&['want','maybe','skip'].includes(v)) out.push({item_key:k.slice(prefix.length),value:v});
      }
      return out;
    }
    function sync(obj){
      fetch('/api/preferences/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:ownPrefs(obj)}),keepalive:true})
        .then(r=>{if(r.ok) originalSetItem.call(localStorage,migrationKey,'1');}).catch(()=>{});
    }
    if(!migrated) sync(merged);
    Storage.prototype.setItem=function(key,value){
      if(this===localStorage&&key==='cr-profile') value=PROFILE;
      originalSetItem.call(this,key,value);
      if(this===localStorage&&key==='cr-prefs'){
        try{sync(JSON.parse(value||'{}'));}catch{}
      }
    };
  })();<\/script>`;
}

async function serveIndex(request, env) {
  const email = authenticatedEmail(request);
  if (!email) {
    const indexUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  }

  await ensureSchema(env);
  const profile = await getProfile(env, email);
  if (!profile) return claimPage(email);

  const rows = await allPreferences(env);
  const indexUrl = new URL('/index.html', request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
  let html = await assetResponse.text();
  html = html.replace('<script>', `${bootstrapScript(profile, rows)}\n<script>`);

  const headers = new Headers(assetResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.delete('Content-Length');
  return new Response(html, { status: assetResponse.status, headers });
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
      return new Response('CANCÚNIO backend error', { status: 500 });
    }
  },
};
