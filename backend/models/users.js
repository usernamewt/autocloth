const { getDb } = require('./db');
const { authRequired } = require('./auth');

function register(app) {
  app.get('/api/v1/users/me', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const [rows] = await db.query(
        'SELECT id, email, display_name, avatar_url, onboarding_completed, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      const user = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!user) return res.status(404).json({ detail: 'User not found' });
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });
}

module.exports = { register };
