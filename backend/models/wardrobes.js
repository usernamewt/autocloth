const { randomUUID } = require('crypto');
const { getDb } = require('./db');
const { authRequired } = require('./auth');

function register(app) {
  app.get('/api/v1/wardrobes', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const [rows] = await db.query(
        'SELECT id, name, season, is_default, sort_order, created_at, updated_at FROM wardrobes WHERE user_id = ? ORDER BY is_default DESC, sort_order ASC, created_at DESC',
        [userId]
      );
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/wardrobes', authRequired, async (req, res) => {
    const { name, season = 'all_season', is_default = false } = req.body || {};
    if (!name) return res.status(400).json({ detail: 'Missing required field: name' });

    const userId = String(req.user.sub);
    const id = randomUUID();

    try {
      const db = await getDb();

      if (is_default) {
        await db.query('UPDATE wardrobes SET is_default = 0 WHERE user_id = ?', [userId]);
      }

      await db.query(
        'INSERT INTO wardrobes (id, user_id, name, season, is_default, sort_order) VALUES (?,?,?,?,?,0)',
        [id, userId, name, season, is_default ? 1 : 0]
      );

      const [rows] = await db.query(
        'SELECT id, name, season, is_default, sort_order, created_at, updated_at FROM wardrobes WHERE id = ? LIMIT 1',
        [id]
      );
      return res.status(201).json(rows[0]);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.patch('/api/v1/wardrobes/:id', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const wardrobeId = String(req.params.id);
    const { name, season, is_default } = req.body || {};
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (season !== undefined) { sets.push('season = ?'); params.push(season); }
    if (sets.length === 0 && is_default === undefined) return res.status(400).json({ detail: 'Nothing to update' });
    try {
      const db = await getDb();
      if (is_default) {
        await db.query('UPDATE wardrobes SET is_default = 0 WHERE user_id = ?', [userId]);
        sets.push('is_default = 1');
      }
      if (sets.length > 0) {
        params.push(wardrobeId, userId);
        const [result] = await db.query(`UPDATE wardrobes SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
        if (result.affectedRows === 0) return res.status(404).json({ detail: 'Wardrobe not found' });
      }
      const [rows] = await db.query('SELECT id, name, season, is_default, sort_order, created_at, updated_at FROM wardrobes WHERE id = ? LIMIT 1', [wardrobeId]);
      return res.json(rows[0]);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.delete('/api/v1/wardrobes/:id', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const wardrobeId = String(req.params.id);
    try {
      const db = await getDb();
      await db.query('UPDATE items SET wardrobe_id = NULL WHERE wardrobe_id = ? AND user_id = ?', [wardrobeId, userId]);
      const [result] = await db.query('DELETE FROM wardrobes WHERE id = ? AND user_id = ?', [wardrobeId, userId]);
      if (result.affectedRows === 0) return res.status(404).json({ detail: 'Wardrobe not found' });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });
}

module.exports = { register };
