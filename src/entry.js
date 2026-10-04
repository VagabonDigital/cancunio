import app from './worker.js';

const PROFILES = ['emrys', 'hannah'];

function authenticatedEmail(request) {
  return request.headers.get('cf-access-authenticated-user-email')?.trim().toLowerCase() || null;
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      try {
        await autoAssignRemainingProfile(request, env);
      } catch (error) {
        console.warn('CANCÚNIO automatic identity assignment failed:', error);
      }
    }

    return app.fetch(request, env, ctx);
  },
};
