const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { randomUUID } = require('crypto');
const option = require('../key');
const { getDb } = require('./db');
const { SAVE_DIR } = require('./config');
const { mapItemRow, buildPreviewUrl, parseGrsaiSse } = require('./helpers');
const { authRequired, verifyAccessToken } = require('./auth');
const { classifyItem } = require('./taxonomy');

const PART_PROMPTS = {
  top:   '请从图片中只保留单件上衣本体，完整呈现出衣服轮廓（包含袖子、领口、下摆等），移除人物、皮肤、头发、手、背景、衣架、地面、阴影杂物与文字水印。\n将衣服居中摆放，保持真实颜色与材质纹理，不要改变款式、不增加配饰。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影增强立体感，但不要出现地面/桌面。\n输出为电商商品图风格，清晰、整洁、高质量。',
  pants: '请从图片中只保留裤子本体，完整呈现出裤子轮廓（包含腰头、裤腿、口袋等细节），移除人物、皮肤、鞋子、背景、衣架、阴影杂物与文字水印。\n将裤子居中摆放，保持真实颜色与材质纹理，不要改变款式、不增加配饰。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  hat:   '请从图片中只保留帽子本体，完整呈现出帽子轮廓（包含帽顶、帽檐、帽带等细节），移除人物、头发、皮肤、背景、阴影杂物与文字水印。\n将帽子居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  bag:   '请从图片中只保留包袋本体，完整呈现出包袋轮廓（包含提手、背带、五金配件、缝线等细节），移除人物、皮肤、背景、阴影杂物与文字水印。\n将包袋居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  shoes: '请从图片中只保留鞋子本体，完整呈现出鞋子轮廓（包含鞋面、鞋底、鞋头、后跟等细节），移除人物、脚踝、地面、背景、阴影杂物与文字水印。\n将鞋子居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  scarf: '请从图片中只保留围巾/领巾本体，完整呈现出围巾形状（包含图案、边缘细节等），移除人物、颈部、背景、阴影杂物与文字水印。\n将围巾平铺或自然悬挂展示，保持真实颜色与材质纹理，不要改变图案。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
};
const DEFAULT_ITEM_PROMPT = PART_PROMPTS.top;

function register(app, { upload, itemEvents }) {
  app.get('/api/v1/items', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);

      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const favorite = typeof req.query.favorite === 'string' ? req.query.favorite : undefined;
      const needsWash = typeof req.query.needs_wash === 'string' ? req.query.needs_wash : undefined;

      const where = ['user_id = ?'];
      const params = [userId];

      if (favorite !== undefined) {
        where.push('favorite = ?');
        params.push(favorite === 'true' ? 1 : 0);
      }
      if (needsWash !== undefined) {
        where.push('needs_wash = ?');
        params.push(needsWash === 'true' ? 1 : 0);
      }
      if (search) {
        where.push('(name LIKE ? OR type LIKE ? OR notes LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const [rows] = await db.query(
        `SELECT id, user_id, wardrobe_id, type, subtype, name, brand, notes, favorite, image_path, thumbnail_path, tags, colors, primary_color, status, wear_count, suggestion_count, needs_wash, created_at, updated_at
         FROM items
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT 200`,
        params
      );

      const itemList = Array.isArray(rows) ? rows : [];
      const itemIds = itemList.map((r) => r.id);
      const taxMap = {};
      if (itemIds.length > 0) {
        const ph = itemIds.map(() => '?').join(',');
        const [taxRows] = await db.query(
          `SELECT it.item_id, tt.display_name, tg.key_name AS group_key
           FROM item_taxonomy it
           JOIN taxonomy_terms tt ON it.term_id = tt.id
           JOIN taxonomy_groups tg ON tt.group_id = tg.id
           WHERE it.item_id IN (${ph})`,
          itemIds
        );
        for (const t of (Array.isArray(taxRows) ? taxRows : [])) {
          if (!taxMap[t.item_id]) taxMap[t.item_id] = {};
          if (!taxMap[t.item_id][t.group_key]) taxMap[t.item_id][t.group_key] = [];
          taxMap[t.item_id][t.group_key].push(t.display_name);
        }
      }

      return res.json({
        items: itemList.map((r) => {
          const mapped = mapItemRow(req, r);
          const tax = taxMap[r.id] || {};
          if (tax.garment_type?.length > 0) mapped.taxonomy_type_label = tax.garment_type.join('/');
          if (tax.color?.length > 0) mapped.taxonomy_color_labels = tax.color;
          return mapped;
        }),
        page: 1,
        page_size: 200,
        total: itemList.length,
      });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.get('/api/v1/items/:id', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const id = String(req.params.id);
      const [rows] = await db.query(
        'SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1',
        [id, userId]
      );
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row) return res.status(404).json({ detail: 'Item not found' });
      return res.json(mapItemRow(req, row));
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/items', authRequired, upload.single('image'), async (req, res) => {
    const { name = null, type = 'unknown', wardrobe_id = null, prompt = '', part = '' } = req.body || {};
    const file = req.file;
    if (!file) return res.status(400).json({ detail: 'Missing required field: image' });

    const userId = String(req.user.sub);
    const itemId = randomUUID();
    const partPrompt = part && PART_PROMPTS[part] ? PART_PROMPTS[part] : DEFAULT_ITEM_PROMPT;
    const finalPrompt = String(prompt || '').trim() || partPrompt;

    try {
      const db = await getDb();

      await db.query(
        'INSERT INTO items (id, user_id, wardrobe_id, type, name, favorite, image_path, thumbnail_path, medium_path, tags, colors, status, ai_processed, effective_wash_interval, is_archived) VALUES (?,?,?,?,?,0,?,?,?,?,?,\'processing\',0,0,0)',
        [
          itemId,
          userId,
          wardrobe_id || null,
          String(type || 'unknown'),
          name ? String(name) : null,
          '',
          null,
          null,
          JSON.stringify({}),
          JSON.stringify([]),
        ]
      );

      console.log(`[items.create] user=${userId} item=${itemId} promptLen=${finalPrompt.length}`);

      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      const itemForResponse = mapItemRow(req, rows[0]);
      res.status(201).json(itemForResponse);

      const imageBuffer = file.buffer;
      const imageName = file.originalname || 'image.png';

      ;(async () => {
        try {
          const srcExt = path.extname(imageName).toLowerCase() || '.png';
          const srcFilename = `item_src_${itemId}${srcExt}`;
          const srcPath = path.join(SAVE_DIR, srcFilename);
          fs.writeFileSync(srcPath, imageBuffer);
          console.log(`[items.create][async] item=${itemId} src saved: ${srcPath} (${imageBuffer.length} bytes)`);
          const imageUrl = buildPreviewUrl(req, srcFilename);
          console.log(`[items.create][async] item=${itemId} image URL: ${imageUrl}`);
          console.log(`[items.create][async] item=${itemId} prompt (${finalPrompt.length} chars): ${finalPrompt.slice(0, 120)}...`);
          console.log(`[items.create][async] item=${itemId} calling ${option.fitting_img2img.url} model=${option.fitting_img2img.model}`);

          const t0 = Date.now();
          const response = await axios.post(
            option.fitting_img2img.url,
            { model: option.fitting_img2img.model, prompt: finalPrompt, urls: [imageUrl], aspectRatio: '1:1' },
            {
              headers: {
                Authorization: `Bearer ${option.fitting_img2img.api_key}`,
                'Content-Type': 'application/json',
              },
              timeout: 600000,
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
              responseType: 'text',
            }
          );
          console.log(`[items.create][async] item=${itemId} http=${response.status}, elapsed=${Date.now()-t0}ms`);

          console.log(`[items.create][async] item=${itemId} raw response (first 500): ${String(response.data).slice(0, 500)}`);
          const data = parseGrsaiSse(response.data);
          console.log(`[items.create][async] item=${itemId} parsed frame: status=${data?.status} progress=${data?.progress} url=${data?.url} results=${JSON.stringify(data?.results ?? null).slice(0, 200)}`);
          if (data?.code !== undefined && data.code !== 0) {
            throw new Error(`grsai API error ${data.code}: ${data.msg || data.message || JSON.stringify(data)}`);
          }
          const resultUrl = data?.url || data?.results?.[0]?.url;
          if (!resultUrl) {
            const errMsg = `图生图未返回图片URL，响应: ${JSON.stringify(data).slice(0, 300)}`;
            console.error(`[items.create][async] item=${itemId} img2img returned empty result, full body: ${JSON.stringify(data).slice(0, 1000)}`);
            const db2 = await getDb();
            await db2.query('UPDATE items SET status = \'error\' WHERE id = ? AND user_id = ?', [itemId, userId]);
            itemEvents.emit(`item:${itemId}`, { status: 'error', message: errMsg });
            return;
          }

          const imgUrl = resultUrl;
          console.log(`[items.create][async] item=${itemId} result URL: ${imgUrl}`);

          // Store external URL directly — server may not reach the CDN.
          // The frontend browser will re-upload the image via PUT /api/v1/items/:id/image.
          const db2 = await getDb();
          await db2.query(
            'UPDATE items SET status = \'ready\', image_path = ?, thumbnail_path = ?, medium_path = ?, ai_processed = 1 WHERE id = ? AND user_id = ?',
            [imgUrl, imgUrl, imgUrl, itemId, userId]
          );
          console.log(`[items.create][async] item=${itemId} done, stored external_url (browser will re-upload)`);

          const db3 = await getDb();
          const [doneRows] = await db3.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
          itemEvents.emit(`item:${itemId}`, { status: 'ready', item: doneRows[0] });
        } catch (bgErr) {
          console.error(`[items.create][async] item=${itemId} failed: code=${bgErr.code} status=${bgErr.response?.status} msg=${bgErr.message}`);
          if (bgErr.response?.data) console.error(`[items.create][async] item=${itemId} error body:`, JSON.stringify(bgErr.response.data).slice(0, 500));
          try {
            const db2 = await getDb();
            await db2.query('UPDATE items SET status = \'error\' WHERE id = ? AND user_id = ?', [itemId, userId]);
          } catch (_) {
            // ignore
          }
          itemEvents.emit(`item:${itemId}`, { status: 'error', message: bgErr.message });
        }
      })();
    } catch (e) {
      try {
        const db = await getDb();
        await db.query('UPDATE items SET status = \'error\' WHERE id = ? AND user_id = ?', [itemId, userId]);
      } catch (_) {
        // ignore
      }
      return res.status(500).json({ detail: 'Create item failed', message: e.message });
    }
  });

  app.get('/api/v1/items/:id/events', async (req, res) => {
    const token = req.query.token || '';
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ detail: 'Invalid token' });
    }

    const userId = String(payload.sub);
    const itemId = String(req.params.id);

    try {
      const db = await getDb();
      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ detail: 'Item not found' });
      }
      const current = rows[0];

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();

      if (current.status !== 'processing') {
        res.write(`data: ${JSON.stringify({ status: current.status, item: mapItemRow(req, current) })}\n\n`);
        return res.end();
      }

      const eventName = `item:${itemId}`;

      const onResult = (payload) => {
        if (payload.item) {
          payload.item = mapItemRow(req, payload.item);
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        res.end();
      };

      itemEvents.once(eventName, onResult);

      req.on('close', () => {
        itemEvents.removeListener(eventName, onResult);
      });

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(': heartbeat\n\n');
      }, 30000);

      const pollTimer = setInterval(async () => {
        if (res.writableEnded) { clearInterval(pollTimer); return; }
        try {
          const db2 = await getDb();
          const [pollRows] = await db2.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
          if (!pollRows || pollRows.length === 0) return;
          const pollItem = pollRows[0];
          if (pollItem.status !== 'processing') {
            clearInterval(pollTimer);
            itemEvents.removeListener(eventName, onResult);
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ status: pollItem.status, item: mapItemRow(req, pollItem) })}\n\n`);
              res.end();
            }
          }
        } catch {}
      }, 5000);

      res.on('close', () => { clearInterval(heartbeat); clearInterval(pollTimer); });
    } catch (e) {
      if (!res.headersSent) {
        return res.status(500).json({ detail: 'SSE setup error', message: e.message });
      }
    }
  });

  app.put('/api/v1/items/:id/image', authRequired, upload.single('image'), async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ detail: 'Missing image file' });

    try {
      const db = await getDb();
      const [rows] = await db.query('SELECT id FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ detail: 'Item not found' });

      const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase() || 'png';
      const filename = `item_${itemId}.${ext}`;
      const savePath = path.join(SAVE_DIR, filename);
      fs.writeFileSync(savePath, file.buffer);
      console.log(`[items.image] item=${itemId} saved local copy: ${savePath} (${file.buffer.length} bytes)`);

      await db.query(
        'UPDATE items SET image_path = ?, thumbnail_path = ?, medium_path = ? WHERE id = ? AND user_id = ?',
        [filename, filename, filename, itemId, userId]
      );

      const [updatedRows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      const item = mapItemRow(req, updatedRows[0]);

      classifyItem(userId, itemId, filename).then(() => {
        console.log(`[items.image] item=${itemId} auto-classify done`);
      }).catch((e) => {
        console.warn(`[items.image] item=${itemId} auto-classify failed (non-fatal): ${e.message}`);
      });

      return res.json(item);
    } catch (e) {
      return res.status(500).json({ detail: 'Save image failed', message: e.message });
    }
  });

  app.patch('/api/v1/items/:id', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    const { name, type, notes, brand, favorite, needs_wash, wardrobe_id, purchase_date, purchase_price } = req.body || {};

    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name || null); }
    if (type !== undefined) { sets.push('type = ?'); params.push(type || 'unknown'); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes || null); }
    if (brand !== undefined) { sets.push('brand = ?'); params.push(brand || null); }
    if (favorite !== undefined) { sets.push('favorite = ?'); params.push(favorite ? 1 : 0); }
    if (needs_wash !== undefined) { sets.push('needs_wash = ?'); params.push(needs_wash ? 1 : 0); }
    if (wardrobe_id !== undefined) { sets.push('wardrobe_id = ?'); params.push(wardrobe_id || null); }
    if (purchase_date !== undefined) { sets.push('purchase_date = ?'); params.push(purchase_date || null); }
    if (purchase_price !== undefined) { sets.push('purchase_price = ?'); params.push(purchase_price != null ? Number(purchase_price) : null); }
    if (sets.length === 0) return res.status(400).json({ detail: 'Nothing to update' });

    sets.push('updated_at = NOW()');
    params.push(itemId, userId);
    try {
      const db = await getDb();
      const [result] = await db.query(`UPDATE items SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
      if (result.affectedRows === 0) return res.status(404).json({ detail: 'Item not found' });
      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      return res.json(mapItemRow(req, rows[0]));
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.delete('/api/v1/items/:id', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    try {
      const db = await getDb();
      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ detail: 'Item not found' });
      const item = rows[0];
      for (const field of ['image_path', 'thumbnail_path', 'medium_path']) {
        if (item[field] && fs.existsSync(item[field])) {
          try { fs.unlinkSync(item[field]); } catch {}
        }
      }
      await db.query('DELETE FROM item_taxonomy WHERE item_id = ?', [itemId]);
      await db.query('DELETE FROM items WHERE id = ? AND user_id = ?', [itemId, userId]);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.post('/api/v1/items/:id/wear', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const itemId = String(req.params.id);
    try {
      const db = await getDb();
      const [result] = await db.query(
        'UPDATE items SET wear_count = wear_count + 1, wears_since_wash = wears_since_wash + 1, last_worn_at = NOW() WHERE id = ? AND user_id = ?',
        [itemId, userId]
      );
      if (result.affectedRows === 0) return res.status(404).json({ detail: 'Item not found' });
      const [rows] = await db.query('SELECT * FROM items WHERE id = ? AND user_id = ? LIMIT 1', [itemId, userId]);
      return res.json(mapItemRow(req, rows[0]));
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });
}

module.exports = { register };
