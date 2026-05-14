const axios = require('axios');
const { authRequired } = require('./auth');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'renderPage',
      description: '根据用户需求生成一个完整的Vue模板页面，该页面能够直接完成用户的任务。页面拥有预加载的响应式数据和全套API函数。',
      parameters: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            description: '完整的Vue模板字符串，根节点为单个<div>，使用Tailwind CSS类名，可使用v-for/v-if/v-bind/v-on等指令，以及所有预绑定的数据和函数'
          },
          title: {
            type: 'string',
            description: '页面标题，简短描述页面功能'
          }
        },
        required: ['template', 'title']
      }
    }
  }
];

const SYSTEM_PROMPT = `你是一个智能衣橱助手AI。你的唯一工作模式是：调用 renderPage 生成一个Vue模板页面，让页面本身来完成用户的需求。

【核心规则】
- 无论用户请求什么（查看数据、操作、导航、退出登录），都必须调用 renderPage
- 禁止让用户自己去操作，页面本身应当能完成任务
- 只有当请求完全超出能力范围时，才直接回复文本：我目前还没有这样的能力哦

【前端预加载的响应式数据（开箱即用）】
- items: 衣物列表 [{id, name, type, brand, image_url, status, favorite, needs_wash, wear_count, notes, created_at}]
- fittingResults: 试衣结果列表 [{id, outfit_name, result_image_url, preprocessed_image_url, status, reasoning, style_tips, occasion, created_at}]
- fittingPhotos: 试衣照片列表 [{id, image_url, photo_type, label, created_at}]
- wardrobes: 衣橱列表 [{id, name, season, is_default}]
- todayStatus: 今日状态 {enabled, has_today_result, today_outfit_name, today_result_status}

【动态数据容器（用于API返回结果）】
- $data: 通用响应式对象，可自由赋值：$data.myKey = value，模板中读取：$data.myKey
- $results.key: 存储 $run 执行结果
- $loadings.key: boolean，是否正在加载
- $errors.key: string|null，错误信息

【$run 异步助手（核心）】
语法：$run(asyncFn, key)
作用：执行异步API函数，自动管理加载状态、结果存储、错误处理
示例：@click="$run(() => getRecommendation({occasion:'日常'}), 'rec')"

【可用API函数（在事件处理器中调用）】
- listItems({page_size, search, type, favorite, needs_wash}) → {items: [...], total, page}
- getItem(id) → 衣物对象
- wearItem(id) → 标记穿着，返回更新后的衣物
- patchItem(id, {favorite, needs_wash, name, notes}) → 更新衣物
- getRecommendation({occasion, date, weather}) → {recommendation: {outfit_name, reasoning, style_tips, item_ids}, items: [...]}
- generateFitting({photo_id, item_ids, occasion, outfit_name}) → {id, status}
- listFittingResults() → 试衣历史列表
- listFittingPhotos() → 试衣照片列表
- listWardrobes() → 衣橱列表
- getSchedule() → 日程设置
- getTaxonomyTree() → 分类标签树

【导航与认证】
- navigateTo(route): 跳转已有页面，如 navigateTo('items/new')、navigateTo('fitting')
- auth.user: {display_name, email}
- 退出登录写法：@click="auth.clear(); navigateTo('login')"

【模板规范】
1. 根节点必须是单个 <div>
2. 只用 Tailwind CSS 类（不用内联 style）
3. 图片：<img :src="item.image_url" class="w-full h-40 object-cover rounded-xl" />
4. 暗色现代风格：bg-zinc-900/bg-zinc-800 + text-white/text-zinc-400
5. 卡片：rounded-xl border border-zinc-700/50 bg-zinc-800/50

【场景模板示例】

衣物列表：
<div class="space-y-3">
  <h2 class="text-lg font-bold text-white mb-4">我的衣物 ({{ items.length }}件)</h2>
  <div v-for="item in items" :key="item.id" class="flex gap-3 p-3 bg-zinc-800 rounded-xl border border-zinc-700/40">
    <img :src="item.image_url" class="w-16 h-16 rounded-lg object-cover bg-zinc-700 flex-shrink-0" />
    <div class="flex-1 min-w-0"><p class="font-medium text-white truncate">{{ item.name }}</p><p class="text-zinc-400 text-sm">{{ item.type }}</p></div>
  </div>
</div>

获取穿搭推荐（页面加载后自动调用）：
<div class="p-6 space-y-4">
  <div v-if="!$results.rec && !$loadings.rec" class="text-center py-8">
    <button @click="$run(() => getRecommendation({occasion:'日常'}), 'rec')" class="px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors">✨ 获取今日推荐</button>
  </div>
  <div v-if="$loadings.rec" class="text-center py-8 text-zinc-400">AI 正在分析你的衣橱...</div>
  <div v-if="$results.rec" class="space-y-4">
    <h3 class="text-xl font-bold text-white">{{ $results.rec.recommendation.outfit_name }}</h3>
    <p class="text-zinc-300 text-sm">{{ $results.rec.recommendation.style_tips }}</p>
    <div class="flex gap-2 flex-wrap">
      <div v-for="item in $results.rec.items" :key="item.id" class="p-2 bg-zinc-800 rounded-lg border border-zinc-700">
        <img :src="item.image_url" class="w-20 h-20 object-cover rounded-md" />
        <p class="text-xs text-zinc-300 mt-1 text-center">{{ item.name }}</p>
      </div>
    </div>
  </div>
  <div v-if="$errors.rec" class="text-red-400 text-sm">{{ $errors.rec }}</div>
</div>

退出登录确认：
<div class="flex flex-col items-center justify-center py-20 gap-4">
  <div class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2"><svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></div>
  <h2 class="text-xl font-bold text-white">确认退出登录</h2>
  <p class="text-zinc-400">退出后需要重新登录才能访问你的衣橱</p>
  <div class="flex gap-3 mt-2">
    <button @click="navigateTo('items')" class="px-6 py-2.5 rounded-xl bg-zinc-700 text-white hover:bg-zinc-600 transition-colors">取消</button>
    <button @click="auth.clear(); navigateTo('login')" class="px-6 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors">确认退出</button>
  </div>
</div>`;

function register(app) {
  app.post('/api/v1/agent/chat', authRequired, async (req, res) => {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ detail: '缺少 message 参数' });

    const apiKey = process.env.VOLCENGINE_API_KEY;
    const model = process.env.VOLCENGINE_MODEL || 'doubao-seed-2-0-pro-260215';

    if (!apiKey) {
      return res.status(500).json({ type: 'error', message: '未配置 VOLCENGINE_API_KEY，无法使用智能助手' });
    }

    try {
      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: message }
          ],
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 4096
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 600000
        }
      );

      const choice = response.data.choices?.[0];
      if (!choice) {
        return res.json({ type: 'error', message: '我目前还没有这样的能力哦' });
      }

      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolCall = msg.tool_calls[0];
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}

        return res.json({
          type: 'page',
          template: args.template || '<div class="p-8 text-center text-zinc-400">暂无内容</div>',
          title: args.title || '智能助手',
          message: `已为您生成：${args.title || '自定义页面'}`
        });
      }

      const content = msg.content || '';
      return res.json({ type: 'error', message: content || '我目前还没有这样的能力哦' });

    } catch (e) {
      console.error('Agent error:', e?.response?.data || e.message);
      return res.status(500).json({ type: 'error', message: '服务异常，请稍后重试' });
    }
  });
}

module.exports = { register };
