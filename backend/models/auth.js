const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

function issueAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : (req.query.token || null);
  if (!token) return res.status(401).json({ detail: 'Missing Authorization Bearer token' });
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
}

async function ensureUserInDb({ external_id, email, display_name, avatar_url }) {
  const db = await getDb();
  const userId = String(external_id || email);

  const [rows] = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (Array.isArray(rows) && rows.length > 0) return { id: userId, isNewUser: false };

  await db.query(
    'INSERT INTO users (id, external_id, email, display_name, avatar_url, onboarding_completed) VALUES (?,?,?,?,?,0)',
    [userId, external_id || null, email, display_name || email.split('@')[0], avatar_url || null]
  );

  return { id: userId, isNewUser: true };
}

function register(app) {
  app.get('/api/v1/auth/status', (req, res) => {
    return res.json({ configured: true });
  });

  app.post('/api/v1/auth/sync', async (req, res) => {
    const { external_id, email, display_name, avatar_url } = req.body || {};

    if (!email) {
      return res.status(400).json({ detail: 'Missing required field: email' });
    }

    const user = {
      id: String(external_id || email),
      external_id: external_id || null,
      email,
      display_name: display_name || email.split('@')[0],
      avatar_url: avatar_url || null,
      onboarding_completed: false,
    };

    try {
      const ensured = await ensureUserInDb({
        external_id: user.external_id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      });

      const access_token = issueAccessToken({ sub: ensured.id, email: user.email });
      return res.json({
        access_token,
        id: ensured.id,
        is_new_user: ensured.isNewUser,
        onboarding_completed: false,
        user: { ...user, id: ensured.id },
      });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });
}

module.exports = { register, authRequired, verifyAccessToken };
