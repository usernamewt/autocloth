/**
 * AI 穿搭闹钟 — 每日定时自动推荐 + 试衣合成 + 应用内通知
 *
 * 表: daily_outfit_schedules
 * 调度: node-cron 每分钟检查，固定提前 PREPARE_MINS 分钟触发（后端常量，不暴露给用户）
 * 通知: notification_pending flag → 前端 poll today-status → tab badge
 */

// 后端固定缓冲时间：提前几分钟开始生成（通常 5 分钟内完成）
const PREPARE_MINS = 5;

const path = require('path');
const axios = require('axios');
const { randomUUID } = require('crypto');
const cron = require('node-cron');
const FormData = require('form-data');
const fs = require('fs');
const option = require('../key');
const { getDb } = require('./db');
const { SAVE_DIR } = require('./config');
const { buildPreviewUrlStatic } = require('./helpers');
const { authRequired } = require('./auth');
const { createFittingPreprocessedImage, parseGrsaiSse } = require('./fitting');

// ─────────────────────────────────────────────
//  Beijing time helpers
// ─────────────────────────────────────────────
function nowBJ() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}
function bjDateStr() { return nowBJ().toISOString().slice(0, 10); }
function bjTimeHHMM() { return nowBJ().toISOString().slice(11, 16); }

function calcTriggerHHMM(alarmHHMM, prepareMins) {
  const [h, m] = alarmHHMM.split(':').map(Number);
  const total = ((h * 60 + m - prepareMins) % 1440 + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

// ─────────────────────────────────────────────
//  Core: DeepSeek 穿搭推荐 (no req/res)
// ─────────────────────────────────────────────
async function coreRecommend(db, userId, { date, occasion }) {
  const today = date || bjDateStr();
  const occasionInfo = occasion || '日常';

  const [items] = await db.query(
    `SELECT i.id, i.name, i.type, i.primary_color,
            GROUP_CONCAT(DISTINCT CONCAT(tg.display_name, ':', tt.display_name) SEPARATOR ', ') AS taxonomy_labels
     FROM items i
     LEFT JOIN item_taxonomy it ON it.item_id = i.id
     LEFT JOIN taxonomy_terms tt ON tt.id = it.term_id
     LEFT JOIN taxonomy_groups tg ON tg.id = tt.group_id
     WHERE i.user_id = ? AND i.status = 'ready'
     GROUP BY i.id ORDER BY i.created_at DESC LIMIT 100`,
    [userId]
  );
  if (!items || items.length === 0) throw new Error('衣橱中没有可用的衣物');

  const itemList = items.map((item, idx) => {
    const labels = item.taxonomy_labels || '未分类';
    const color = item.primary_color || '未知颜色';
    const name = item.name || item.type || '衣物';
    return `${idx + 1}. [ID:${item.id}] ${name} | 颜色:${color} | 分类:${labels}`;
  }).join('\n');

  const systemPrompt = `你是一个专业的时尚穿搭顾问AI。用户会提供他们的衣橱清单（每件衣物有ID、名称、颜色、分类标签），以及当天的日期、天气、场景。
你需要：
1. 根据天气、场景、季节选择合适的衣物组合
2. 返回严格的JSON格式

返回格式（严格JSON，不要markdown）：
{
  "item_ids": ["衣物ID1", "衣物ID2"],
  "outfit_name": "穿搭方案名称",
  "reasoning": "推荐理由，100字以内",
  "style_tips": "搭配小贴士，50字以内",
  "prompt": "一段英文描述，用于图生图合成试衣效果。描述这套穿搭穿在人身上的样子，包含衣物的颜色、材质、款式等细节，200字以内"
}`;

  const userPrompt = `日期：${today}\n天气：今日推荐\n场景：${occasionInfo}\n\n我的衣橱清单：\n${itemList}\n\n请从中挑选衣物，推荐一套穿搭方案。`;

  let dsResponse;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      dsResponse = await axios.post(
        option.deepseek.url,
        { model: option.deepseek.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, max_tokens: 1024 },
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${option.deepseek.api_key}` }, timeout: 120000 }
      );
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }

  const rawContent = dsResponse.data?.choices?.[0]?.message?.content || '';
  const jsonStr = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const recommendation = JSON.parse(jsonStr);

  const validIds = new Set(items.map(i => i.id));
  recommendation.item_ids = (recommendation.item_ids || []).filter(id => validIds.has(id));

  // 保存推荐记录（纯文字推荐，photo_id = null）
  const recResultId = randomUUID();
  await db.query(
    'INSERT INTO fitting_results (id, user_id, photo_id, item_ids, prompt, status) VALUES (?,?,?,?,?,?)',
    [recResultId, userId, null, JSON.stringify(recommendation.item_ids), recommendation.prompt || '', 'pending']
  ).catch(e => console.warn('[daily_outfit] save rec failed:', e.message));
  await db.query(
    'UPDATE fitting_results SET outfit_name=?,occasion=?,outfit_date=?,reasoning=?,style_tips=? WHERE id=?',
    [recommendation.outfit_name || null, occasionInfo, today, recommendation.reasoning || null, recommendation.style_tips || null, recResultId]
  ).catch(() => {});

  return { ...recommendation, recResultId };
}

// ─────────────────────────────────────────────
//  Core: 图生图合成 (no req/res)
// ─────────────────────────────────────────────
async function coreGenerate(db, userId, { photo_id, photo, item_ids, outfit_name, occasion, outfit_date, reasoning, style_tips, prompt: userPrompt }) {
  const ph = item_ids.map(() => '?').join(',');
  const [itemRows] = await db.query(
    `SELECT id, name, type, primary_color, image_path FROM items WHERE id IN (${ph}) AND user_id = ? AND status = 'ready'`,
    [...item_ids, userId]
  );
  if (!itemRows || itemRows.length === 0) throw new Error('没有找到可用的衣物图片');

  const resultId = randomUUID();
  await db.query(
    'INSERT INTO fitting_results (id, user_id, photo_id, item_ids, prompt, status) VALUES (?,?,?,?,?,?)',
    [resultId, userId, photo_id, JSON.stringify(item_ids), userPrompt || '', 'generating']
  );
  await db.query(
    'UPDATE fitting_results SET outfit_name=?,occasion=?,outfit_date=?,reasoning=?,style_tips=? WHERE id=?',
    [outfit_name || null, occasion || null, outfit_date || null, reasoning || null, style_tips || null, resultId]
  ).catch(() => {});

  // Preprocessed composite image
  const preprocessedPath = await createFittingPreprocessedImage(photo.image_path, itemRows, resultId);
  const preprocessedFilename = path.basename(preprocessedPath);
  await db.query('UPDATE fitting_results SET preprocessed_image_path=? WHERE id=?', [preprocessedFilename, resultId]);

  const inputUrl = buildPreviewUrlStatic(preprocessedFilename);

  // Build prompt
  const clothingDescParts = [];
  for (const item of itemRows) {
    if (!item.image_path) continue;
    const fullPath = path.isAbsolute(item.image_path) ? item.image_path : path.join(SAVE_DIR, item.image_path);
    if (!fs.existsSync(fullPath)) continue;
    const name = item.name || item.type || '衣物';
    const color = item.primary_color || '';
    clothingDescParts.push(`${name}${color ? `(${color})` : ''}`);
  }
  if (clothingDescParts.length === 0) throw new Error('没有找到衣物图片文件');

  const clothingList = clothingDescParts.join('、');
  const isHalfBody = photo.photo_type === 'half_body';
  const bodyDesc = isHalfBody ? '半身照（上半身）' : '全身照';
  const outputDesc = isHalfBody
    ? '输出一张半身照，只展示上半身，不要补全下半身，构图与人物原照一致'
    : '输出一张全身照，构图与人物原照一致';

  const finalPrompt = userPrompt || (
    `提供的图片是一张由多张参考图横向合成的调试图。最左侧是一个人的${bodyDesc}，这是需要换装的目标人物。` +
    `右侧是衣物商品参考图，具体包括：${clothingList}。` +
    `\n\n【任务要求】：只做衣服替换，将最左侧人物当前穿着的衣服替换为右侧衣物参考图中的衣物。` +
    `\n\n【严格约束】：` +
    `1. 人物的面部五官、表情、发型、肤色、体型、姿势、站位必须与原照完全一致，不得有任何改动。` +
    `2. 衣物的颜色、图案、花纹、面料质感、款式细节必须与商品图完全一致，精确还原。` +
    `3. 衣物必须自然穿着在人物身上，有合理的褶皱、垂坠感，贴合身体轮廓。` +
    `4. 光影效果和背景与人物原照保持一致。5. ${outputDesc}。` +
    `6. 不要在输出中包含右侧衣物参考图，只输出换装后的单张人物照片。` +
    `7. 不要添加任何文字、水印、边框。8. 最终输出一张高质量、真实自然的照片。`
  );

  // 调用 (grsai)
  const img2imgCfg = option.fitting_img2img;
  const t0 = Date.now();
  const submitResp = await axios.post(
    img2imgCfg.url,
    { model: img2imgCfg.model, prompt: finalPrompt, urls: [inputUrl], aspectRatio: '1:1' },
    {
      headers: { Authorization: `Bearer ${img2imgCfg.api_key}`, 'Content-Type': 'application/json' },
      timeout: 600000, maxContentLength: Infinity, maxBodyLength: Infinity, responseType: 'text',
    }
  );
  console.log(`[daily_outfit/generate] http=${submitResp.status}, elapsed=${Date.now() - t0}ms`);

  const submitData = parseGrsaiSse(submitResp.data);
  if (submitData?.code !== undefined && submitData.code !== 0) {
    throw new Error(`grsai API error ${submitData.code}: ${submitData.msg || JSON.stringify(submitData)}`);
  }
  const resultUrl = submitData?.url || submitData?.results?.[0]?.url;
  if (!resultUrl) throw new Error(`图生图未返回图片URL，响应: ${JSON.stringify(submitData).slice(0, 300)}`);

  await db.query(
    'UPDATE fitting_results SET status=?,result_image_path=?,prompt=? WHERE id=?',
    ['ready', resultUrl, finalPrompt, resultId]
  );
  return { resultId };
}

// ─────────────────────────────────────────────
//  Scheduler: process one user's daily schedule
// ─────────────────────────────────────────────
async function processUserSchedule(db, schedule, today) {
  const userId = schedule.user_id;
  console.log(`[daily_outfit] running for user=${userId}, alarm=${schedule.alarm_time}`);

  // 立刻标记今天已运行（防止重复）
  await db.query(
    'UPDATE daily_outfit_schedules SET last_run_date=? WHERE user_id=?',
    [today, userId]
  );

  try {
    // Step 1: AI 推荐
    const rec = await coreRecommend(db, userId, { date: today, occasion: schedule.occasion });
    console.log(`[daily_outfit] recommend OK for ${userId}, item_ids=${rec.item_ids}`);

    // Step 2: 试衣合成（如果有形象照且有推荐单品）
    if (rec.item_ids && rec.item_ids.length > 0) {
      const [photoRows] = await db.query(
        'SELECT id, image_path, photo_type FROM fitting_photos WHERE user_id=? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      if (photoRows && photoRows.length > 0) {
        try {
          await coreGenerate(db, userId, {
            photo_id: photoRows[0].id,
            photo: photoRows[0],
            item_ids: rec.item_ids,
            outfit_name: rec.outfit_name,
            occasion: schedule.occasion,
            outfit_date: today,
            reasoning: rec.reasoning,
            style_tips: rec.style_tips,
            prompt: rec.prompt,
          });
          console.log(`[daily_outfit] generate OK for ${userId}`);
        } catch (genErr) {
          console.warn(`[daily_outfit] generate failed for ${userId}:`, genErr.message);
        }
      }
    }

    // Step 3: 标记通知待读
    await db.query(
      'UPDATE daily_outfit_schedules SET notification_pending=1 WHERE user_id=?',
      [userId]
    );
  } catch (e) {
    console.error(`[daily_outfit] failed for ${userId}:`, e.message);
  }
}

// ─────────────────────────────────────────────
//  Scheduler entry point
// ─────────────────────────────────────────────
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const db = await getDb();
      const today = bjDateStr();
      const current = bjTimeHHMM();

      const [rows] = await db.query(
        `SELECT * FROM daily_outfit_schedules WHERE enabled=1 AND (last_run_date IS NULL OR last_run_date != ?)`,
        [today]
      );

      for (const s of (rows || [])) {
        const trigger = calcTriggerHHMM(s.alarm_time, PREPARE_MINS);
        if (trigger !== current) continue;
        // Run async, don't block the tick
        processUserSchedule(db, s, today).catch(e =>
          console.error('[daily_outfit] processUserSchedule threw:', e.message)
        );
      }
    } catch (e) {
      console.error('[daily_outfit] scheduler tick error:', e.message);
    }
  });
  console.log('[daily_outfit] AI 穿搭闹钟 scheduler started ⏰');
}

// ─────────────────────────────────────────────
//  HTTP API routes
// ─────────────────────────────────────────────
function register(app) {
  // Init table
  ;(async () => {
    try {
      const db = await getDb();
      await db.query(`CREATE TABLE IF NOT EXISTS daily_outfit_schedules (
        user_id          CHAR(36)     PRIMARY KEY,
        alarm_time       VARCHAR(5)   NOT NULL DEFAULT '08:00',
        prepare_mins     INT          NOT NULL DEFAULT 5,
        occasion         VARCHAR(64)  NOT NULL DEFAULT '日常',
        enabled          TINYINT(1)   NOT NULL DEFAULT 1,
        last_run_date    VARCHAR(10)  NULL,
        notification_pending TINYINT(1) NOT NULL DEFAULT 0,
        created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      )`);
      console.log('[daily_outfit] table ensured');
    } catch (e) {
      console.error('[daily_outfit] table init error:', e.message);
    }
  })();

  // GET /api/v1/daily-outfit/schedule — 查询当前设置 & 通知状态
  app.get('/api/v1/daily-outfit/schedule', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    try {
      const db = await getDb();
      const [rows] = await db.query('SELECT * FROM daily_outfit_schedules WHERE user_id=? LIMIT 1', [userId]);
      if (!rows || rows.length === 0) return res.json({ exists: false });
      const r = rows[0];
      return res.json({
        exists: true,
        alarm_time: r.alarm_time,
        occasion: r.occasion,
        enabled: !!r.enabled,
        last_run_date: r.last_run_date,
        trigger_time: calcTriggerHHMM(r.alarm_time, PREPARE_MINS),
      });
    } catch (e) { return res.status(500).json({ detail: e.message }); }
  });

  // POST /api/v1/daily-outfit/schedule — 保存/更新
  app.post('/api/v1/daily-outfit/schedule', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const { alarm_time, occasion = '日常', enabled = true } = req.body || {};
    if (!alarm_time || !/^\d{2}:\d{2}$/.test(alarm_time)) {
      return res.status(400).json({ detail: 'alarm_time 格式必须为 HH:MM' });
    }
    try {
      const db = await getDb();
      await db.query(
        `INSERT INTO daily_outfit_schedules (user_id, alarm_time, prepare_mins, occasion, enabled)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE alarm_time=VALUES(alarm_time),
           occasion=VALUES(occasion), enabled=VALUES(enabled), updated_at=CURRENT_TIMESTAMP(3)`,
        [userId, alarm_time, PREPARE_MINS, occasion, enabled ? 1 : 0]
      );
      return res.json({
        success: true,
        alarm_time,
        occasion,
        enabled: !!enabled,
        trigger_time: calcTriggerHHMM(alarm_time, PREPARE_MINS),
      });
    } catch (e) { return res.status(500).json({ detail: e.message }); }
  });

  // DELETE /api/v1/daily-outfit/schedule — 关闭闹钟
  app.delete('/api/v1/daily-outfit/schedule', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    try {
      const db = await getDb();
      await db.query('DELETE FROM daily_outfit_schedules WHERE user_id=?', [userId]);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ detail: e.message }); }
  });

  // GET /api/v1/daily-outfit/today-status — 前端轮询通知状态
  app.get('/api/v1/daily-outfit/today-status', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    const today = bjDateStr();
    try {
      const db = await getDb();
      const [schRows] = await db.query('SELECT * FROM daily_outfit_schedules WHERE user_id=? LIMIT 1', [userId]);
      const sch = schRows && schRows.length > 0 ? schRows[0] : null;

      // 查今天最新的 fitting_result
      const [resRows] = await db.query(
        `SELECT id, status, outfit_name FROM fitting_results WHERE user_id=? AND outfit_date=? ORDER BY created_at DESC LIMIT 1`,
        [userId, today]
      );
      const todayResult = resRows && resRows.length > 0 ? resRows[0] : null;

      return res.json({
        enabled: !!sch?.enabled,
        alarm_time: sch?.alarm_time || null,
        notification_pending: !!(sch?.notification_pending),
        has_today_result: !!todayResult,
        today_result_id: todayResult?.id || null,
        today_outfit_name: todayResult?.outfit_name || null,
        today_result_status: todayResult?.status || null,
      });
    } catch (e) { return res.status(500).json({ detail: e.message }); }
  });

  // POST /api/v1/daily-outfit/mark-seen — 前端已读，清除 badge
  app.post('/api/v1/daily-outfit/mark-seen', authRequired, async (req, res) => {
    const userId = String(req.user.sub);
    try {
      const db = await getDb();
      await db.query('UPDATE daily_outfit_schedules SET notification_pending=0 WHERE user_id=?', [userId]);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ detail: e.message }); }
  });
}

module.exports = { register, startScheduler };
