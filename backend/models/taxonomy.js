const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { getDb } = require('./db');
const { mapItemRow } = require('./helpers');
const { authRequired } = require('./auth');
const { SAVE_DIR } = require('./config');
const option = require('../key');
const taxonomySeed = require('../taxonomy_seed');

async function insertTerms(db, userId, groupId, terms, parentId = null, sortBase = 0) {
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const termId = randomUUID();
    try {
      await db.query(
        'INSERT INTO taxonomy_terms (id, user_id, group_id, key_name, display_name, parent_id, sort_order, is_system) VALUES (?,?,?,?,?,?,?,1)',
        [termId, userId, groupId, t.key_name, t.display_name, parentId, sortBase + i]
      );
    } catch (e) {
      if (!String(e.message || '').includes('Duplicate')) throw e;
      const [existing] = await db.query(
        'SELECT id FROM taxonomy_terms WHERE user_id = ? AND group_id = ? AND key_name = ? LIMIT 1',
        [userId, groupId, t.key_name]
      );
      if (existing.length > 0 && t.children && t.children.length > 0) {
        await insertTerms(db, userId, groupId, t.children, existing[0].id, 0);
      }
      continue;
    }
    if (t.children && t.children.length > 0) {
      await insertTerms(db, userId, groupId, t.children, termId, 0);
    }
  }
}

function countTerms(terms) {
  let n = 0;
  for (const t of terms) {
    n++;
    if (t.children) n += countTerms(t.children);
  }
  return n;
}

function register(app) {
  app.get('/api/v1/taxonomy/groups', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const [rows] = await db.query(
        'SELECT id, key_name, display_name, sort_order, is_system, created_at, updated_at FROM taxonomy_groups WHERE user_id = ? ORDER BY is_system DESC, sort_order ASC, created_at DESC',
        [userId]
      );
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/taxonomy/groups', authRequired, async (req, res) => {
    const { key_name, display_name } = req.body || {};
    if (!key_name) return res.status(400).json({ detail: 'Missing required field: key_name' });
    if (!display_name) return res.status(400).json({ detail: 'Missing required field: display_name' });

    const userId = String(req.user.sub);
    const id = randomUUID();

    try {
      const db = await getDb();
      await db.query(
        'INSERT INTO taxonomy_groups (id, user_id, key_name, display_name, is_system, sort_order) VALUES (?,?,?,?,0,0)',
        [id, userId, key_name, display_name]
      );
      const [rows] = await db.query(
        'SELECT id, key_name, display_name, sort_order, is_system, created_at, updated_at FROM taxonomy_groups WHERE id = ? LIMIT 1',
        [id]
      );
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (String(e.message || '').includes('Duplicate')) {
        return res.status(409).json({ detail: 'Duplicate key_name in this user' });
      }
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.get('/api/v1/taxonomy/groups/:groupId/terms', authRequired, async (req, res) => {
    const groupId = req.params.groupId;
    const userId = String(req.user.sub);

    try {
      const db = await getDb();
      const [rows] = await db.query(
        'SELECT id, group_id, key_name, display_name, parent_id, sort_order, is_system, created_at, updated_at FROM taxonomy_terms WHERE user_id = ? AND group_id = ? ORDER BY is_system DESC, sort_order ASC, created_at DESC',
        [userId, groupId]
      );
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/taxonomy/groups/:groupId/terms', authRequired, async (req, res) => {
    const groupId = req.params.groupId;
    const { key_name, display_name, parent_id = null } = req.body || {};
    if (!key_name) return res.status(400).json({ detail: 'Missing required field: key_name' });
    if (!display_name) return res.status(400).json({ detail: 'Missing required field: display_name' });

    const userId = String(req.user.sub);
    const id = randomUUID();

    try {
      const db = await getDb();
      await db.query(
        'INSERT INTO taxonomy_terms (id, user_id, group_id, key_name, display_name, parent_id, sort_order, is_system) VALUES (?,?,?,?,?,?,0,0)',
        [id, userId, groupId, key_name, display_name, parent_id]
      );
      const [rows] = await db.query(
        'SELECT id, group_id, key_name, display_name, parent_id, sort_order, is_system, created_at, updated_at FROM taxonomy_terms WHERE id = ? LIMIT 1',
        [id]
      );
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (String(e.message || '').includes('Duplicate')) {
        return res.status(409).json({ detail: 'Duplicate key_name in this group' });
      }
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/taxonomy/seed', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    try {
      const db = await getDb();
      let groupCount = 0;
      let termCount = 0;

      for (const group of taxonomySeed) {
        const groupId = randomUUID();
        try {
          await db.query(
            'INSERT INTO taxonomy_groups (id, user_id, key_name, display_name, is_system, sort_order) VALUES (?,?,?,?,1,?)',
            [groupId, userId, group.key_name, group.display_name, group.sort_order || 0]
          );
          groupCount++;
        } catch (e) {
          if (!String(e.message || '').includes('Duplicate')) throw e;
          const [existing] = await db.query(
            'SELECT id FROM taxonomy_groups WHERE user_id = ? AND key_name = ? LIMIT 1',
            [userId, group.key_name]
          );
          if (existing.length > 0) {
            await insertTerms(db, userId, existing[0].id, group.terms || []);
            termCount += countTerms(group.terms || []);
            continue;
          }
        }
        if (group.terms && group.terms.length > 0) {
          await insertTerms(db, userId, groupId, group.terms);
          termCount += countTerms(group.terms);
        }
      }

      return res.json({ success: true, groups_created: groupCount, terms_created: termCount });
    } catch (e) {
      return res.status(500).json({ detail: 'Seed failed', message: e.message });
    }
  });

  app.get('/api/v1/taxonomy/tree', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    try {
      const db = await getDb();
      const [groups] = await db.query(
        'SELECT id, key_name, display_name, sort_order, is_system FROM taxonomy_groups WHERE user_id = ? ORDER BY sort_order ASC',
        [userId]
      );
      const [terms] = await db.query(
        'SELECT id, group_id, key_name, display_name, parent_id, sort_order, is_system FROM taxonomy_terms WHERE user_id = ? ORDER BY sort_order ASC',
        [userId]
      );

      const termsByGroup = {};
      for (const t of terms) {
        if (!termsByGroup[t.group_id]) termsByGroup[t.group_id] = [];
        termsByGroup[t.group_id].push(t);
      }

      const tree = groups.map((g) => {
        const flatTerms = termsByGroup[g.id] || [];
        const byId = {};
        for (const t of flatTerms) { byId[t.id] = { ...t, children: [] }; }
        const roots = [];
        for (const t of flatTerms) {
          if (t.parent_id && byId[t.parent_id]) {
            byId[t.parent_id].children.push(byId[t.id]);
          } else {
            roots.push(byId[t.id]);
          }
        }
        return { ...g, terms: roots };
      });

      return res.json(tree);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.get('/api/v1/items/:id/taxonomy', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    try {
      const db = await getDb();
      const [rows] = await db.query(
        `SELECT it.term_id, tt.group_id, tt.key_name, tt.display_name, tt.parent_id
         FROM item_taxonomy it
         JOIN taxonomy_terms tt ON tt.id = it.term_id
         JOIN items i ON i.id = it.item_id
         WHERE it.item_id = ? AND i.user_id = ?`,
        [itemId, userId]
      );
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.put('/api/v1/items/:id/taxonomy', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    const { term_ids = [] } = req.body || {};

    try {
      const db = await getDb();
      const [itemRows] = await db.query('SELECT id FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      if (!Array.isArray(itemRows) || itemRows.length === 0) {
        return res.status(404).json({ detail: 'Item not found' });
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM item_taxonomy WHERE item_id = ?', [itemId]);
        if (Array.isArray(term_ids) && term_ids.length > 0) {
          const values = term_ids.map((tid) => [itemId, String(tid)]);
          await conn.query('INSERT INTO item_taxonomy (item_id, term_id) VALUES ?', [values]);
        }
        await conn.commit();
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }

      return res.json({ success: true, item_id: itemId, term_ids });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.patch('/api/v1/items/:id/color', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    const { primary_color, colors } = req.body || {};

    try {
      const db = await getDb();
      const sets = [];
      const params = [];
      if (primary_color !== undefined) { sets.push('primary_color = ?'); params.push(primary_color); }
      if (colors !== undefined) { sets.push('colors = ?'); params.push(JSON.stringify(colors)); }
      if (sets.length === 0) return res.status(400).json({ detail: 'Nothing to update' });

      params.push(itemId, userId);
      const [result] = await db.query(
        `UPDATE items SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
      if (result.affectedRows === 0) return res.status(404).json({ detail: 'Item not found' });

      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      return res.json(mapItemRow(req, rows[0]));
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/items/:id/ai-classify', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);

    try {
      const db = await getDb();

      const [itemRows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      if (!Array.isArray(itemRows) || itemRows.length === 0) {
        return res.status(404).json({ detail: 'Item not found' });
      }
      const item = itemRows[0];

      if (!item.image_path) {
        return res.status(400).json({ detail: 'Item image not ready yet' });
      }
      const imagePath = path.join(SAVE_DIR, path.basename(item.image_path));
      if (!fs.existsSync(imagePath)) {
        return res.status(400).json({ detail: 'Image file not found on disk' });
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(item.image_path).replace('.', '').toLowerCase() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      const base64Image = imageBuffer.toString('base64');

      const [groups] = await db.query(
        'SELECT id, key_name, display_name FROM taxonomy_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
        [userId]
      );
      const [terms] = await db.query(
        'SELECT id, group_id, key_name, display_name, parent_id FROM taxonomy_terms WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
        [userId]
      );

      if (!groups.length && !terms.length) {
        return res.json({ success: true, term_ids: [], ai_content: '', detail: 'No taxonomy defined' });
      }

      const termsByGroup = {};
      for (const t of terms) {
        if (!termsByGroup[t.group_id]) termsByGroup[t.group_id] = [];
        termsByGroup[t.group_id].push(t);
      }

      function formatTermTree(gTerms, parentId, depth) {
        const children = gTerms.filter(t => (parentId ? t.parent_id === parentId : !t.parent_id));
        let text = '';
        for (const t of children) {
          text += '  '.repeat(depth) + `- ${t.display_name}（id: ${t.id}）\n`;
          text += formatTermTree(gTerms, t.id, depth + 1);
        }
        return text;
      }

      let taxonomyText = '';
      for (const g of groups) {
        const gTerms = termsByGroup[g.id] || [];
        if (!gTerms.length) continue;
        taxonomyText += `\n【${g.display_name}（${g.key_name}）】\n`;
        taxonomyText += formatTermTree(gTerms, null, 0);
      }

      const prompt = `你是一个专业服装分类助手。请仔细分析这张衣服图片，根据以下分类体系为其选择最合适的分类标签。

分类体系：${taxonomyText}
请根据图片中的衣服特征（款式、颜色、材质、风格、季节、适合场合等），从上面的分类体系中选择最合适的标签。

要求：
1. 只选择真正适合的标签，不强制每个分类组都选
2. 每个分类组最多选 3-5 个最相关的标签
3. 必须使用分类中括号内的 id 字段值
4. 只返回 JSON，不要其他内容

返回格式：{"term_ids": ["id1", "id2", ...]}`;

      if (!option.volcengine || !option.volcengine.api_key) {
        return res.status(500).json({ detail: 'VOLCENGINE_API_KEY not configured' });
      }

      console.log(`[ai-classify] item=${itemId} calling Volcengine vision model`);

      const volcRes = await axios.post(option.volcengine.url, {
        model: option.volcengine.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: prompt },
          ],
        }],
      }, {
        headers: {
          'Authorization': `Bearer ${option.volcengine.api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const aiContent = volcRes.data.choices?.[0]?.message?.content || '';
      console.log(`[ai-classify] item=${itemId} ai_content=${aiContent}`);

      let termIds = [];
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          termIds = Array.isArray(parsed.term_ids) ? parsed.term_ids.map(String) : [];
        }
      } catch (parseErr) {
        console.error(`[ai-classify] JSON parse error: ${parseErr.message}`);
      }

      if (termIds.length > 0) {
        const placeholders = termIds.map(() => '?').join(',');
        const [validTerms] = await db.query(
          `SELECT id FROM taxonomy_terms WHERE user_id = ? AND id IN (${placeholders})`,
          [userId, ...termIds]
        );
        termIds = validTerms.map(t => t.id);
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM item_taxonomy WHERE item_id = ?', [itemId]);
        if (termIds.length > 0) {
          const values = termIds.map(tid => [itemId, String(tid)]);
          await conn.query('INSERT INTO item_taxonomy (item_id, term_id) VALUES ?', [values]);
        }
        await conn.commit();
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }

      console.log(`[ai-classify] item=${itemId} classified with ${termIds.length} terms`);
      return res.json({ success: true, term_ids: termIds, ai_content: aiContent });
    } catch (e) {
      console.error(`[ai-classify] item=${itemId} error: ${e.message}`);
      return res.status(500).json({ detail: 'AI classify failed', message: e.message });
    }
  });
}

module.exports = { register };
