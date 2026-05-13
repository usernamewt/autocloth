const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { URL } = require('url');
const { SAVE_DIR } = require('./config');
const { buildPreviewUrl } = require('./helpers');
const { authRequired } = require('./auth');

function extractFilenameFromHeaders(headers) {
  const disposition = headers['content-disposition'];
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];

  const plainMatch = disposition.match(/filename=([^;]+)/i);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

function register(app, { upload } = {}) {
  if (upload) {
    app.post('/api/v1/upload', authRequired, upload.single('image'), (req, res) => {
      const file = req.file;
      if (!file) return res.status(400).json({ detail: 'Missing required field: image' });

      const ext = path.extname(file.originalname || '').replace(/[^a-z0-9.]/gi, '').toLowerCase() || 'png';
      const filename = `upload_${randomUUID()}.${ext}`;
      const savePath = path.join(SAVE_DIR, filename);

      try {
        fs.writeFileSync(savePath, file.buffer);
        return res.status(201).json({
          filename,
          url: buildPreviewUrl(req, filename),
        });
      } catch (e) {
        return res.status(500).json({ detail: 'Upload failed', message: e.message });
      }
    });
  }

  app.post('/download', async (req, res) => {
    const { url, filename, headers: extraHeaders = {} } = req.body;

    if (!url) {
      return res.status(400).json({ error: '缺少必填参数: url' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: '无效的 URL 格式' });
    }

    try {
      console.log(`[下载] 请求地址: ${url}`);

      const response = await axios.get(url, {
        responseType: 'stream',
        headers: extraHeaders,
        timeout: 30000,
      });

      const savedFilename = filename
        || extractFilenameFromHeaders(response.headers)
        || path.basename(parsedUrl.pathname)
        || `file_${Date.now()}`;

      const safeFilename = path.basename(savedFilename);
      const savePath = path.join(SAVE_DIR, safeFilename);

      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(savePath);
      console.log(`[完成] 文件已保存: ${savePath} (${stats.size} bytes)`);

      return res.json({
        success: true,
        filename: safeFilename,
        path: savePath,
        size: stats.size,
        contentType: response.headers['content-type'] || 'unknown',
      });
    } catch (err) {
      console.error(`[错误] 下载失败: ${err.message}`);

      if (err.response) {
        return res.status(502).json({
          error: '目标接口返回错误',
          status: err.response.status,
          message: err.message,
        });
      }

      return res.status(500).json({
        error: '下载失败',
        message: err.message,
      });
    }
  });

  app.get('/preview/:filename', (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(SAVE_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    return res.sendFile(path.resolve(filePath));
  });

  app.get('/files', (req, res) => {
    try {
      if (!fs.existsSync(SAVE_DIR)) {
        return res.json({ files: [], count: 0, directory: SAVE_DIR });
      }

      const files = fs.readdirSync(SAVE_DIR)
        .filter((name) => {
          const filePath = path.join(SAVE_DIR, name);
          return fs.statSync(filePath).isFile();
        })
        .map((name) => {
          const filePath = path.join(SAVE_DIR, name);
          const stats = fs.statSync(filePath);
          return {
            filename: name,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        });

      return res.json({ files, count: files.length, directory: SAVE_DIR });
    } catch (err) {
      return res.status(500).json({ error: '读取文件列表失败', message: err.message });
    }
  });
}

module.exports = { register };
