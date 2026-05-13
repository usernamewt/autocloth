const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { EventEmitter } = require('events');
require('dotenv').config();

const { SAVE_DIR } = require('./models/config');

const app = express();
const itemEvents = new EventEmitter();
itemEvents.setMaxListeners(0);
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(SAVE_DIR)) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
}

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// --- 注册路由模块 ---
require('./models/auth').register(app);
require('./models/items').register(app, { upload, itemEvents });
require('./models/users').register(app);
require('./models/wardrobes').register(app);
require('./models/taxonomy').register(app);
require('./models/download').register(app, { upload });
require('./models/imageGen').register(app, { upload });
require('./models/fitting').register(app, { upload, itemEvents });
const dailyOutfit = require('./models/daily_outfit');
dailyOutfit.register(app);
dailyOutfit.startScheduler();

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`文件保存目录: ${SAVE_DIR}`);
  console.log('');
  console.log('接口说明:');
  console.log(`  POST http://localhost:${PORT}/generate-image — 文生图`);
  console.log(`  POST http://localhost:${PORT}/edit-image     — 图生图`);
  console.log(`  POST http://localhost:${PORT}/download       — 下载文件`);
  console.log(`  GET  http://localhost:${PORT}/files          — 查看已下载文件`);
});
