const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { randomUUID } = require('crypto');
const sharp = require('sharp');
const option = require('../key');
const { getDb } = require('./db');
const { SAVE_DIR } = require('./config');
const { buildPreviewUrl, mapItemRow, parseGrsaiSse } = require('./helpers');
const { authRequired } = require('./auth');

function tryParseGrsaiSsePayload(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lines = raw.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!line.startsWith('data:')) continue;
    const payload = line.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      return JSON.parse(payload);
    } catch {
      continue;
    }
  }
  return null;
}

async function downloadImageArrayBuffer(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[fitting/generate] downloading result image (attempt ${attempt}/3): ${url}`);
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 300000,
        headers: {
          Accept: '*/*',
          'User-Agent': 'autopackage-backend',
        },
      });
      console.log(`[fitting/generate] download OK (attempt ${attempt}/3), bytes: ${resp.data?.byteLength ?? resp.data?.length ?? 'unknown'}`);
      return resp.data;
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      console.warn(`[fitting/generate] download failed (attempt ${attempt}/3): ${e.message}${status ? ` (status=${status})` : ''}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

async function createFittingPreprocessedImage(photoPath, itemRows, resultId) {
  const fullPhotoPath = path.isAbsolute(photoPath) ? photoPath : path.join(SAVE_DIR, photoPath);
  if (!fs.existsSync(fullPhotoPath)) {
    throw new Error(`预处理失败：人物图片文件不存在: ${fullPhotoPath}`);
  }

  const inputPaths = [fullPhotoPath];
  for (const item of itemRows) {
    if (!item.image_path) continue;
    const fullPath = path.isAbsolute(item.image_path) ? item.image_path : path.join(SAVE_DIR, item.image_path);
    if (fs.existsSync(fullPath)) inputPaths.push(fullPath);
  }
  if (inputPaths.length < 2) throw new Error('预处理失败：没有找到可用的衣物图片文件');

  const tileWidth = 360;
  const tileHeight = 480;
  const gap = 16;
  const labelHeight = 28;
  const width = inputPaths.length * tileWidth + (inputPaths.length + 1) * gap;
  const height = tileHeight + labelHeight + gap * 2;
  const composites = [];

  for (let i = 0; i < inputPaths.length; i++) {
    const buffer = await sharp(inputPaths[i])
      .rotate()
      .resize(tileWidth, tileHeight, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    composites.push({
      input: buffer,
      left: gap + i * (tileWidth + gap) + Math.floor((tileWidth - (meta.width || tileWidth)) / 2),
      top: gap + labelHeight + Math.floor((tileHeight - (meta.height || tileHeight)) / 2),
    });
  }

  const labelSvg = `<svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial,sans-serif;font-size:16px;fill:#333}</style>${inputPaths.map((_, i) => `<text x="${gap + i * (tileWidth + gap)}" y="20">${i === 0 ? 'Person photo' : `Clothing ${i}`}</text>`).join('')}</svg>`;
  composites.push({ input: Buffer.from(labelSvg), left: 0, top: gap });

  const filename = `fitting_preprocessed_${resultId}.png`;
  const outputPath = path.join(SAVE_DIR, filename);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f8fafc',
    },
  }).composite(composites).png().toFile(outputPath);
  return outputPath;
}

function mapFittingResult(req, r) {
  const resultPath = r.result_image_path || null;
  const resultIsUrl = typeof resultPath === 'string' && /^https?:\/\//i.test(resultPath);
  return {
    id: r.id,
    photo_id: r.photo_id,
    item_ids: typeof r.item_ids === 'string' ? JSON.parse(r.item_ids) : r.item_ids,
    outfit_name: r.outfit_name || null,
    occasion: r.occasion || null,
    outfit_date: r.outfit_date || null,
    reasoning: r.reasoning || null,
    style_tips: r.style_tips || null,
    prompt: r.prompt,
    preprocessed_image_url: r.preprocessed_image_path ? buildPreviewUrl(req, path.basename(r.preprocessed_image_path)) : null,
    result_image_url: resultIsUrl ? resultPath : (resultPath ? buildPreviewUrl(req, path.basename(resultPath)) : null),
    weather: typeof r.weather === 'string' ? JSON.parse(r.weather || 'null') : r.weather,
    status: r.status,
    error_message: r.error_message,
    created_at: r.created_at,
  };
}

function register(app, { upload, itemEvents }) {
  // Init tables on startup
  ;(async () => {
    try {
      const db = await getDb();
      await db.query(`CREATE TABLE IF NOT EXISTS fitting_photos (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        label VARCHAR(64) NULL,
        photo_type ENUM('full_body','half_body') NOT NULL DEFAULT 'full_body',
        image_path TEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_fitting_photos_user_id (user_id)
      )`);
      await db.query(`CREATE TABLE IF NOT EXISTS fitting_results (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        photo_id CHAR(36) NOT NULL,
        item_ids JSON NOT NULL,
        recommendation TEXT NULL,
        prompt TEXT NULL,
        preprocessed_image_path TEXT NULL,
        result_image_path TEXT NULL,
        weather JSON NULL,
        status ENUM('pending','generating','ready','error') NOT NULL DEFAULT 'pending',
        error_message TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_fitting_results_user_id (user_id)
      )`);
      await db.query('ALTER TABLE fitting_results ADD COLUMN preprocessed_image_path TEXT NULL AFTER prompt').catch((e) => {
        if (!String(e.message || '').includes('Duplicate column')) throw e;
      });
      for (const col of [
        'ALTER TABLE fitting_results ADD COLUMN outfit_name VARCHAR(191) NULL AFTER weather',
        'ALTER TABLE fitting_results ADD COLUMN occasion VARCHAR(64) NULL AFTER outfit_name',
        'ALTER TABLE fitting_results ADD COLUMN outfit_date VARCHAR(16) NULL AFTER occasion',
        'ALTER TABLE fitting_results ADD COLUMN reasoning TEXT NULL AFTER outfit_date',
        'ALTER TABLE fitting_results ADD COLUMN style_tips TEXT NULL AFTER reasoning',
      ]) {
        await db.query(col).catch((e) => {
          if (!String(e.message || '').includes('Duplicate column')) throw e;
        });
      }
      await db.query('ALTER TABLE fitting_results MODIFY COLUMN photo_id CHAR(36) NULL').catch(() => {});
      console.log('[fitting] tables ensured');
    } catch (e) {
      console.error('[fitting] table init error:', e.message);
    }
  })();

  // 上传形象照
  app.post('/api/v1/fitting/photos', authRequired, upload.single('image'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ detail: 'Missing required field: image' });

    const userId = String(req.user.sub);
    const label = String(req.body.label || '').trim() || null;
    const photoType = req.body.photo_type === 'half_body' ? 'half_body' : 'full_body';
    const photoId = randomUUID();

    try {
      const filename = `fitting_${photoId}.png`;
      const savePath = path.join(SAVE_DIR, filename);
      fs.writeFileSync(savePath, file.buffer);

      const db = await getDb();
      await db.query(
        'INSERT INTO fitting_photos (id, user_id, label, photo_type, image_path) VALUES (?,?,?,?,?)',
        [photoId, userId, label, photoType, savePath]
      );

      return res.status(201).json({
        id: photoId,
        user_id: userId,
        label,
        photo_type: photoType,
        image_url: buildPreviewUrl(req, filename),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      return res.status(500).json({ detail: 'Upload failed', message: e.message });
    }
  });

  // 列表形象照
  app.get('/api/v1/fitting/photos', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const [rows] = await db.query(
        'SELECT * FROM fitting_photos WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      const photos = (rows || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        label: r.label,
        photo_type: r.photo_type,
        image_url: r.image_path ? buildPreviewUrl(req, path.basename(r.image_path)) : null,
        created_at: r.created_at,
      }));
      return res.json(photos);
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  // 删除形象照
  app.delete('/api/v1/fitting/photos/:id', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const photoId = String(req.params.id);
      const [rows] = await db.query(
        'SELECT image_path FROM fitting_photos WHERE id = ? AND user_id = ?',
        [photoId, userId]
      );
      if (!rows || rows.length === 0) return res.status(404).json({ detail: 'Photo not found' });

      const imgPath = rows[0].image_path;
      await db.query('DELETE FROM fitting_photos WHERE id = ? AND user_id = ?', [photoId, userId]);
      if (imgPath && fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ detail: 'Delete failed', message: e.message });
    }
  });

  // DeepSeek 穿搭推荐
  app.post('/api/v1/fitting/recommend', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const { weather, date, occasion } = req.body || {};

    try {
      const db = await getDb();

      const [items] = await db.query(
        `SELECT i.id, i.name, i.type, i.primary_color,
                GROUP_CONCAT(DISTINCT CONCAT(tg.display_name, ':', tt.display_name) SEPARATOR ', ') AS taxonomy_labels
         FROM items i
         LEFT JOIN item_taxonomy it ON it.item_id = i.id
         LEFT JOIN taxonomy_terms tt ON tt.id = it.term_id
         LEFT JOIN taxonomy_groups tg ON tg.id = tt.group_id
         WHERE i.user_id = ? AND i.status = 'ready'
         GROUP BY i.id
         ORDER BY i.created_at DESC
         LIMIT 100`,
        [userId]
      );

      if (!items || items.length === 0) {
        return res.status(400).json({ detail: '衣橱中没有可用的衣物，请先录入并分类衣物' });
      }

      const itemList = items.map((item, idx) => {
        const labels = item.taxonomy_labels || '未分类';
        const color = item.primary_color || '未知颜色';
        const name = item.name || item.type || '衣物';
        return `${idx + 1}. [ID:${item.id}] ${name} | 颜色:${color} | 分类:${labels}`;
      }).join('\n');

      const today = date || new Date().toISOString().slice(0, 10);
      const weatherInfo = weather ? JSON.stringify(weather) : '未提供天气信息';
      const occasionInfo = occasion || '日常';

      const systemPrompt = `你是一个专业的时尚穿搭顾问AI。用户会提供他们的衣橱清单（每件衣物有ID、名称、颜色、分类标签），以及当天的日期、天气、场景。
你需要：
1. 根据天气、日期（是否有节日）、场景，从衣橱中推荐一套完整的穿搭方案（上衣+下装 或 连衣裙，可选外套）
2. 返回严格的JSON格式

返回格式（严格JSON，不要markdown）：
{
  "item_ids": ["衣物ID1", "衣物ID2"],
  "outfit_name": "穿搭方案名称",
  "reasoning": "推荐理由，100字以内",
  "style_tips": "搭配小贴士，50字以内",
  "prompt": "一段英文描述，用于图生图合成试衣效果。描述这套穿搭穿在人身上的样子，包含衣物的颜色、材质、款式等细节，200字以内"
}`;

      const userPrompt = `日期：${today}
天气：${weatherInfo}
场景：${occasionInfo}

我的衣橱清单：
${itemList}

请从中挑选衣物，推荐一套穿搭方案。`;

      console.log('[fitting/recommend] calling DeepSeek...', option.deepseek.url);
      console.log('[fitting/recommend] items count:', items.length, ', prompt length:', userPrompt.length);

      const DS_MAX_RETRIES = 3;
      const DS_RETRY_DELAY = 3000;
      let dsResponse;
      for (let attempt = 1; attempt <= DS_MAX_RETRIES; attempt++) {
        try {
          console.log('go');
          dsResponse = await axios.post(
            option.deepseek.url,
            {
              model: option.deepseek.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 1024,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${option.deepseek.api_key}`,
              },
              timeout: 120000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            }
          );
          console.log(`[fitting/recommend] DeepSeek responded on attempt ${attempt}, status:`, dsResponse.status);
          break;
        } catch (retryErr) {
          const status = retryErr.response?.status;
          const retryable = !status || status === 503 || status === 429 || status === 502;
          console.warn(`[fitting/recommend] attempt ${attempt}/${DS_MAX_RETRIES} failed: ${retryErr.message} (status=${status})`);
          if (!retryable || attempt === DS_MAX_RETRIES) throw retryErr;
          await new Promise((r) => setTimeout(r, DS_RETRY_DELAY * attempt));
        }
      }

      const rawContent = dsResponse.data?.choices?.[0]?.message?.content || '';
      console.log('[fitting/recommend] DeepSeek raw:', rawContent);

      let recommendation;
      try {
        const jsonStr = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        recommendation = JSON.parse(jsonStr);
      } catch {
        return res.status(502).json({ detail: 'DeepSeek 返回格式异常', raw: rawContent });
      }

      const validIds = new Set(items.map((i) => i.id));
      const filteredIds = (recommendation.item_ids || []).filter((id) => validIds.has(id));
      recommendation.item_ids = filteredIds;

      let recommendedItems = [];
      if (filteredIds.length > 0) {
        const placeholders = filteredIds.map(() => '?').join(',');
        const [recRows] = await db.query(
          `SELECT * FROM items WHERE id IN (${placeholders}) AND user_id = ?`,
          [...filteredIds, userId]
        );
        recommendedItems = (recRows || []).map((r) => mapItemRow(req, r));
      }

      // Save recommendation record to history
      const recResultId = randomUUID();
      await db.query(
        'INSERT INTO fitting_results (id, user_id, photo_id, item_ids, prompt, weather, status) VALUES (?,?,?,?,?,?,?)',
        [recResultId, userId, null, JSON.stringify(filteredIds), recommendation.prompt || '', weather ? JSON.stringify(weather) : null, 'pending']
      ).catch((e) => console.warn('[fitting/recommend] save to history failed:', e.message));
      await db.query(
        'UPDATE fitting_results SET outfit_name=?, occasion=?, outfit_date=?, reasoning=?, style_tips=? WHERE id=?',
        [recommendation.outfit_name || null, occasionInfo, today, recommendation.reasoning || null, recommendation.style_tips || null, recResultId]
      ).catch(() => {});

      return res.json({
        recommendation,
        items: recommendedItems,
        recommendation_id: recResultId,
        context: { date: today, weather: weatherInfo, occasion: occasionInfo },
      });
    } catch (e) {
      console.error('[fitting/recommend] error:', e.message);
      if (e.response) {
        return res.status(502).json({ detail: 'DeepSeek 调用失败', status: e.response.status, message: e.response.data });
      }
      return res.status(500).json({ detail: '推荐失败', message: e.message });
    }
  });

  // 图生图合成试衣效果
  app.post('/api/v1/fitting/generate', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const { photo_id, item_ids, prompt: userPrompt, weather, outfit_name, occasion, outfit_date, reasoning, style_tips } = req.body || {};

    if (!photo_id) return res.status(400).json({ detail: 'Missing photo_id' });
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ detail: 'Missing item_ids' });
    }

    try {
      const db = await getDb();

      const [photoRows] = await db.query(
        'SELECT * FROM fitting_photos WHERE id = ? AND user_id = ?',
        [photo_id, userId]
      );
      if (!photoRows || photoRows.length === 0) {
        return res.status(404).json({ detail: '形象照不存在' });
      }
      const photo = photoRows[0];

      const placeholders = item_ids.map(() => '?').join(',');
      const [itemRows] = await db.query(
        `SELECT id, name, type, primary_color, image_path FROM items WHERE id IN (${placeholders}) AND user_id = ? AND status = 'ready'`,
        [...item_ids, userId]
      );
      if (!itemRows || itemRows.length === 0) {
        return res.status(400).json({ detail: '没有找到可用的衣物图片' });
      }

      const resultId = randomUUID();
      console.log('[fitting/generate] inserting result, userId:', userId, 'photo_id:', photo_id, 'item_ids:', item_ids);
      await db.query(
        'INSERT INTO fitting_results (id, user_id, photo_id, item_ids, prompt, weather, status) VALUES (?,?,?,?,?,?,?)',
        [resultId, userId, photo_id, JSON.stringify(item_ids), userPrompt || '', weather ? JSON.stringify(weather) : null, 'generating']
      );
      console.log('[fitting/generate] insert OK, resultId:', resultId);
      await db.query(
        'UPDATE fitting_results SET outfit_name=?, occasion=?, outfit_date=?, reasoning=?, style_tips=? WHERE id=?',
        [outfit_name || null, occasion || null, outfit_date || null, reasoning || null, style_tips || null, resultId]
      ).catch((e) => console.warn('[fitting/generate] UPDATE context failed (columns may not exist yet):', e.message));

      res.status(201).json({ id: resultId, status: 'generating' });

      ;(async () => {
        let preprocessedPath = '';
        try {
          preprocessedPath = await createFittingPreprocessedImage(photo.image_path, itemRows, resultId);
          const preprocessedFilename = path.basename(preprocessedPath);
          await db.query(
            'UPDATE fitting_results SET preprocessed_image_path = ? WHERE id = ?',
            [preprocessedFilename, resultId]
          );

          const clothingDescParts = [];
          for (let i = 0; i < itemRows.length; i++) {
            const item = itemRows[i];
            let hasFile = false;
            if (item.image_path) {
              const fullPath = path.isAbsolute(item.image_path) ? item.image_path : path.join(SAVE_DIR, item.image_path);
              if (fs.existsSync(fullPath)) hasFile = true;
            }
            if (!hasFile) continue;
            const name = item.name || item.type || '衣物';
            const color = item.primary_color || '';
            clothingDescParts.push(`${name}${color ? `(${color})` : ''}`);
          }

          if (clothingDescParts.length === 0) {
            throw new Error('没有找到衣物图片文件，请确保衣物已上传图片');
          }

          const clothingList = clothingDescParts.join('、');
          const isHalfBody = photo.photo_type === 'half_body';
          const bodyDesc = isHalfBody ? '半身照（上半身）' : '全身照';
          const outputDesc = isHalfBody
            ? '输出一张半身照，只展示上半身，不要补全下半身，构图与人物原照一致'
            : '输出一张全身照，构图与人物原照一致';

          const finalPrompt = userPrompt
            ? userPrompt
            : `提供的图片是一张由多张参考图横向合成的调试图。最左侧是一个人的${bodyDesc}，这是需要换装的目标人物。` +
              `右侧是衣物商品参考图，具体包括：${clothingList}。` +
              `\n\n【任务要求】：` +
              `只做衣服替换，将最左侧人物当前穿着的衣服替换为右侧衣物参考图中的衣物。` +
              `\n\n【严格约束】：` +
              `1. 人物的面部五官、表情、发型、肤色、体型、姿势、站位必须与原照完全一致，不得有任何改动。` +
              `2. 衣物的颜色、图案、花纹、面料质感、款式细节必须与商品图完全一致，精确还原。` +
              `3. 衣物必须自然穿着在人物身上，有合理的褶皱、垂坠感，贴合身体轮廓。` +
              `4. 光影效果和背景与人物原照保持一致。` +
              `5. ${outputDesc}。` +
              `6. 不要在输出中包含右侧衣物参考图，也不要输出拼接版面，只输出换装后的单张人物照片。` +
              `7. 不要添加任何文字、水印、边框、装饰元素。` +
              `8. 不要改变背景、不要改变人物的配饰（如手表、项链等，除非被新衣物遮挡）。` +
              `9. 最终输出一张高质量、真实自然的照片，看起来就像人物本来就穿着这些衣服拍摄的。`;

          console.log(`[fitting/generate] calling img2img async, resultId: ${resultId}, clothing: ${clothingList}`);
          console.log(`[fitting/generate] prompt: ${finalPrompt.slice(0, 200)}...`);

          const img2imgCfg = option.fitting_img2img;
          const submitUrl = img2imgCfg.url;
          console.log(`[fitting/generate] submitting to ${submitUrl} model=${img2imgCfg.model}`);

          const inputUrl = buildPreviewUrl(req, preprocessedFilename);
          console.log(`[fitting/generate] preprocessed image URL: ${inputUrl}`);

          const t0 = Date.now();
          const submitResp = await axios.post(
            submitUrl,
            {
              model: img2imgCfg.model,
              prompt: finalPrompt,
              urls: [inputUrl],
              aspectRatio: '1:1',
            },
            {
              headers: {
                Authorization: `Bearer ${img2imgCfg.api_key}`,
                'Content-Type': 'application/json',
              },
              timeout: 600000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              responseType: 'text',
            }
          );
          console.log(`[fitting/generate] http=${submitResp.status}, elapsed=${Date.now() - t0}ms`);

          console.log(`[fitting/generate] raw response (first 500): ${String(submitResp.data).slice(0, 500)}`);
          const submitData = parseGrsaiSse(submitResp.data);
          console.log(`[fitting/generate] parsed frame: status=${submitData?.status} progress=${submitData?.progress} url=${submitData?.url} results=${JSON.stringify(submitData?.results ?? null).slice(0, 200)}`);

          if (submitData?.code !== undefined && submitData.code !== 0) {
            throw new Error(`grsai API error ${submitData.code}: ${submitData.msg || submitData.message || JSON.stringify(submitData)}`);
          }

          const resultUrl = submitData?.url || submitData?.results?.[0]?.url;
          if (!resultUrl) {
            throw new Error(`图生图未返回图片URL，响应: ${JSON.stringify(submitData).slice(0, 300)}`);
          }

          console.log(`[fitting/generate] result URL: ${resultUrl}`);

          // Store external URL directly — server may not reach the CDN.
          // The frontend browser will re-upload the image via PUT /api/v1/fitting/results/:id/image.
          await db.query(
            'UPDATE fitting_results SET status = ?, result_image_path = ?, prompt = ? WHERE id = ?',
            ['ready', resultUrl, finalPrompt, resultId]
          );

          itemEvents.emit(`fitting:${resultId}`, { status: 'ready', preprocessed_image_path: preprocessedFilename, result_image_path: resultUrl });
        } catch (err) {
          console.error(`[fitting/generate] error for ${resultId}:`, err.message);
          await db.query(
            'UPDATE fitting_results SET status = ?, error_message = ? WHERE id = ?',
            ['error', err.message, resultId]
          ).catch(() => {});
          itemEvents.emit(`fitting:${resultId}`, { status: 'error', error: err.message, preprocessed_image_path: preprocessedPath ? path.basename(preprocessedPath) : null });
        }
      })();
    } catch (e) {
      return res.status(500).json({ detail: '生成失败', message: e.message });
    }
  });

  // 获取试衣结果
  app.get('/api/v1/fitting/results/:id', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const resultId = String(req.params.id);
      const [rows] = await db.query(
        'SELECT * FROM fitting_results WHERE id = ? AND user_id = ?',
        [resultId, userId]
      );
      if (!rows || rows.length === 0) return res.status(404).json({ detail: 'Result not found' });

      const r = rows[0];
      return res.json(mapFittingResult(req, r));
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  // 列表试衣结果
  app.get('/api/v1/fitting/results', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      console.log('[fitting/results] listing for userId:', userId);
      const [rows] = await db.query(
        'SELECT * FROM fitting_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
      );
      console.log('[fitting/results] found rows:', rows?.length ?? 0);
      const results = (rows || []).map((r) => mapFittingResult(req, r));
      return res.json(results);
    } catch (e) {
      console.error('[fitting/results] error:', e.message);
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  app.put('/api/v1/fitting/results/:id/image', authRequired, upload.single('image'), async (req, res) => {
    const userId = String(req.user.sub);
    const resultId = String(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ detail: 'Missing image file' });

    try {
      const db = await getDb();
      const [rows] = await db.query(
        'SELECT id, preprocessed_image_path FROM fitting_results WHERE id = ? AND user_id = ? LIMIT 1',
        [resultId, userId]
      );
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ detail: 'Result not found' });

      const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase() || 'png';
      const filename = `fitting_result_${resultId}.${ext}`;
      const savePath = path.join(SAVE_DIR, filename);
      fs.writeFileSync(savePath, file.buffer);

      await db.query(
        'UPDATE fitting_results SET status = ?, result_image_path = ? WHERE id = ? AND user_id = ?',
        ['ready', filename, resultId, userId]
      );

      const payload = {
        status: 'ready',
        preprocessed_image_path: rows[0].preprocessed_image_path || null,
        result_image_path: filename,
      };
      itemEvents.emit(`fitting:${resultId}`, payload);

      const [updatedRows] = await db.query('SELECT * FROM fitting_results WHERE id = ? AND user_id = ? LIMIT 1', [resultId, userId]);
      return res.json(mapFittingResult(req, updatedRows[0]));
    } catch (e) {
      return res.status(500).json({ detail: 'Save image failed', message: e.message });
    }
  });

  app.get('/api/v1/fitting/debug/download', authRequired, async (req, res) => {
    const url = String(req.query.url || 'https://file1.aitohumanize.com/file/c990d01248ca46d5af51f7c69f4f9782.png');
    try {
      const startedAt = Date.now();
      const data = await downloadImageArrayBuffer(url);
      let ext = '';
      try {
        const pathname = new URL(url).pathname || '';
        ext = path.extname(pathname);
      } catch {
        ext = '';
      }
      if (!ext) ext = '.png';
      const filename = `fitting_debug_${randomUUID()}${ext}`;
      const savePath = path.join(SAVE_DIR, filename);
      fs.writeFileSync(savePath, data);
      return res.json({
        success: true,
        url,
        filename,
        file_url: buildPreviewUrl(req, filename),
        bytes: data?.byteLength ?? data?.length ?? null,
        ms: Date.now() - startedAt,
      });
    } catch (e) {
      return res.status(502).json({
        success: false,
        url,
        message: e.message,
        status: e?.response?.status,
      });
    }
  });

  // 删除试衣结果
  app.delete('/api/v1/fitting/results/:id', authRequired, async (req, res) => {
    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const resultId = String(req.params.id);

      const [rows] = await db.query(
        'SELECT * FROM fitting_results WHERE id = ? AND user_id = ?',
        [resultId, userId]
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ detail: '记录不存在' });
      }

      const r = rows[0];
      if (r.result_image_path && !/^https?:\/\//i.test(String(r.result_image_path))) {
        const filePath = path.isAbsolute(r.result_image_path) ? r.result_image_path : path.join(SAVE_DIR, r.result_image_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      if (r.preprocessed_image_path) {
        const filePath = path.isAbsolute(r.preprocessed_image_path) ? r.preprocessed_image_path : path.join(SAVE_DIR, r.preprocessed_image_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await db.query('DELETE FROM fitting_results WHERE id = ?', [resultId]);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ detail: 'Database error', message: e.message });
    }
  });

  // SSE 监听试衣生成状态
  app.get('/api/v1/fitting/results/:id/events', authRequired, async (req, res) => {
    const resultId = String(req.params.id);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    try {
      const db = await getDb();
      const userId = String(req.user.sub);
      const [rows] = await db.query(
        'SELECT status, preprocessed_image_path, result_image_path, error_message FROM fitting_results WHERE id = ? AND user_id = ?',
        [resultId, userId]
      );
      if (rows && rows.length > 0 && rows[0].status !== 'generating' && rows[0].status !== 'pending') {
        const r = rows[0];
        const isResultUrl = typeof r.result_image_path === 'string' && /^https?:\/\//i.test(r.result_image_path);
        res.write(`data: ${JSON.stringify({
          status: r.status,
          preprocessed_image_url: r.preprocessed_image_path ? buildPreviewUrl(req, path.basename(r.preprocessed_image_path)) : null,
          result_image_url: r.result_image_path ? (isResultUrl ? r.result_image_path : buildPreviewUrl(req, path.basename(r.result_image_path))) : null,
          error: r.error_message,
        })}\n\n`);
        return res.end();
      }
    } catch { /* ignore, wait for event */ }

    const eventName = `fitting:${resultId}`;
    const onResult = (payload) => {
      if (payload.result_image_path) {
        const isUrl = typeof payload.result_image_path === 'string' && /^https?:\/\//i.test(payload.result_image_path);
        payload.result_image_url = isUrl ? payload.result_image_path : buildPreviewUrl(req, path.basename(payload.result_image_path));
        delete payload.result_image_path;
      }
      if (payload.preprocessed_image_path) {
        payload.preprocessed_image_url = buildPreviewUrl(req, path.basename(payload.preprocessed_image_path));
        delete payload.preprocessed_image_path;
      }
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.end();
    };
    itemEvents.once(eventName, onResult);
    req.on('close', () => itemEvents.removeListener(eventName, onResult));

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 30000);
    res.on('close', () => clearInterval(heartbeat));
  });
}

module.exports = { register, createFittingPreprocessedImage, parseGrsaiSse };
