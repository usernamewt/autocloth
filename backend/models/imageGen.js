const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const option = require('../key');
const { SAVE_DIR } = require('./config');

function register(app, { upload }) {
  app.post('/generate-image', async (req, res) => {
    const {
      prompt,
      size = '2560x1440',
      background = option.body.background,
      moderation = option.body.moderation,
      output_format = option.body.output_format,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: '缺少必填参数: prompt' });
    }

    const requestBody = {
      prompt,
      model: option.body.model,
      n: option.body.n,
      size,
      background,
      moderation,
      output_format,
    };

    try {
      console.log(`[生成图像] prompt: ${prompt}, size: ${size}`);

      const response = await axios.post(
        option.url.trim(),
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${option.api_key}`,
            'Content-Type': 'application/json',
          },
          timeout: 600000,
        }
      );

      const data = response.data;
      const images = data.data || [];
      if (images.length === 0) {
        return res.status(502).json({ error: '接口未返回图像数据', raw: data });
      }

      const actualFormat = data.output_format || output_format || 'png';
      const actualSize = data.size || size;
      const savedFiles = [];

      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i].url;
        const revisedPrompt = images[i].revised_prompt || null;

        if (!imgUrl) {
          console.warn(`[警告] 第 ${i + 1} 张图像无 URL，跳过`);
          continue;
        }

        const imgResponse = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          timeout: 300000,
        });

        const filename = `image_${Date.now()}_${i + 1}.${actualFormat}`;
        const savePath = path.join(SAVE_DIR, filename);

        fs.writeFileSync(savePath, imgResponse.data);
        const stats = fs.statSync(savePath);

        console.log(`[完成] 图像已保存: ${savePath} (${stats.size} bytes)`);
        savedFiles.push({
          filename,
          path: savePath,
          size: stats.size,
          url: imgUrl,
          revised_prompt: revisedPrompt,
        });
      }

      return res.json({
        success: true,
        count: savedFiles.length,
        files: savedFiles,
        meta: {
          model: data.model,
          size: actualSize,
          output_format: actualFormat,
          quality: data.quality,
          usage: data.usage,
          created: data.created,
        },
      });
    } catch (err) {
      console.error(`[错误] 图像生成失败: ${err.message}`);

      if (err.response) {
        return res.status(502).json({
          error: '图像生成接口返回错误',
          status: err.response.status,
          message: err.message,
          detail: err.response.data,
        });
      }

      return res.status(500).json({
        error: '图像生成失败',
        message: err.message,
      });
    }
  });

  app.post('/edit-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    const files = req.files;
    const { prompt, size, background, output_format } = req.body;

    if (!files?.image?.[0]) {
      return res.status(400).json({ error: '缺少必填参数: image' });
    }

    if (!prompt) {
      return res.status(400).json({ error: '缺少必填参数: prompt' });
    }

    const imageFile = files.image[0];
    const maskFile = files.mask?.[0];

    try {
      console.log(`[图生图] prompt: ${prompt}, 原图: ${imageFile.originalname || imageFile.size + ' bytes'}`);

      const form = new FormData();
      form.append('image', imageFile.buffer, { filename: imageFile.originalname || 'image.png' });
      form.append('prompt', prompt);
      form.append('model', option.img2img.body.model);
      form.append('quality', option.img2img.body.quality);
      form.append('size', size || option.img2img.body.size);
      form.append('n', String(option.img2img.body.n));
      form.append('background', background || option.img2img.body.background);
      form.append('output_format', output_format || option.img2img.body.output_format);
      form.append('output_compression', String(option.img2img.body.output_compression));
      form.append('partial_images', String(option.img2img.body.partial_images));
      form.append('stream', String(option.img2img.body.stream));

      if (maskFile) {
        form.append('mask', maskFile.buffer, { filename: maskFile.originalname || 'mask.png' });
      }

      const response = await axios.post(
        option.img2img.url,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${option.img2img.api_key}`,
          },
          timeout: 600000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const data = response.data;
      const images = data.data || [];
      if (images.length === 0) {
        return res.status(502).json({ error: '接口未返回图像数据', raw: data });
      }

      const actualFormat = data.output_format || output_format || 'png';
      const savedFiles = [];

      for (let i = 0; i < images.length; i++) {
        const imgUrl = images[i].url;
        if (!imgUrl) continue;

        const imgResponse = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          timeout: 300000,
        });

        const filename = `edit_${Date.now()}_${i + 1}.${actualFormat}`;
        const savePath = path.join(SAVE_DIR, filename);

        fs.writeFileSync(savePath, imgResponse.data);
        const stats = fs.statSync(savePath);

        console.log(`[完成] 图生图已保存: ${savePath} (${stats.size} bytes)`);
        savedFiles.push({ filename, path: savePath, size: stats.size, url: imgUrl });
      }

      return res.json({
        success: true,
        count: savedFiles.length,
        files: savedFiles,
        meta: {
          model: data.model,
          size: data.size,
          output_format: actualFormat,
          quality: data.quality,
          usage: data.usage,
        },
      });
    } catch (err) {
      console.error(`[错误] 图生图失败: ${err.message}`);

      if (err.response) {
        return res.status(502).json({
          error: '图生图接口返回错误',
          status: err.response.status,
          message: err.message,
          detail: err.response.data,
        });
      }

      return res.status(500).json({
        error: '图生图失败',
        message: err.message,
      });
    }
  });
}

module.exports = { register };
