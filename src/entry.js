import app from './worker.js';

const PROFILES = ['emrys', 'hannah'];

function authenticatedEmail(request) {
  return request.headers.get('cf-access-authenticated-user-email')?.trim().toLowerCase() || null;
}

async function getProfile(env, email) {
  if (!email || !env.DB) return null;
  const row = await env.DB.prepare(
    'SELECT profile FROM profiles WHERE user_email = ?'
  ).bind(email).first();
  return row?.profile || null;
}

async function autoAssignRemainingProfile(request, env) {
  const email = authenticatedEmail(request);
  if (!email || !env.DB) return;

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_email TEXT PRIMARY KEY,
      profile TEXT NOT NULL UNIQUE CHECK (profile IN ('emrys','hannah')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const existing = await env.DB.prepare(
    'SELECT profile FROM profiles WHERE user_email = ?'
  ).bind(email).first();
  if (existing?.profile) return;

  const result = await env.DB.prepare(
    "SELECT profile FROM profiles WHERE profile IN ('emrys','hannah')"
  ).all();
  const claimed = new Set((result.results || []).map(row => row.profile));
  const remaining = PROFILES.filter(profile => !claimed.has(profile));

  if (remaining.length !== 1) return;

  try {
    await env.DB.prepare(`
      INSERT INTO profiles (user_email, profile, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(email, remaining[0]).run();
  } catch (error) {
    console.warn('CANCÚNIO profile auto-assignment skipped:', error);
  }
}

async function injectIdentityChip(response, profile) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!profile || !contentType.includes('text/html')) return response;

  const displayName = profile.charAt(0).toUpperCase() + profile.slice(1);
  let html = await response.text();
  const identityUi = `<style>
.identity-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(20,33,32,.12);background:rgba(255,255,255,.9);border-radius:999px;padding:9px 12px;font-size:13px;font-weight:800;line-height:1;white-space:nowrap}
.identity-chip::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent,#10b9a5);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#10b9a5) 15%,transparent)}
@media(max-width:640px){.identity-chip{padding:8px 10px;font-size:12px}}
</style><script>(function(){
  const displayName=${JSON.stringify(displayName)};
  function mountIdentity(){
    const actions=document.querySelector('.topbar-actions');
    if(!actions||actions.querySelector('.identity-chip')) return;
    const chip=document.createElement('span');
    chip.className='identity-chip';
    chip.textContent=displayName;
    chip.title='Signed in as '+displayName;
    chip.setAttribute('aria-label','Signed in as '+displayName);
    const picks=actions.querySelector('.ghost-btn');
    if(picks) actions.insertBefore(chip,picks); else actions.prepend(chip);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountIdentity,{once:true});
  else mountIdentity();
})();<\/script>`;

  html = html.replace('</body>', `${identityUi}\n</body>`);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('Cache-Control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isHome = request.method === 'GET' && url.pathname === '/';
    let profile = null;

    if (isHome) {
      try {
        await autoAssignRemainingProfile(request, env);
        profile = await getProfile(env, authenticatedEmail(request));
      } catch (error) {
        console.warn('CANCÚNIO automatic identity assignment failed:', error);
      }
    }

    const response = await app.fetch(request, env, ctx);
    return isHome ? injectIdentityChip(response, profile) : response;
  },
};
