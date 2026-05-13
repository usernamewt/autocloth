const option = {
  
}

// 试衣间图生图接口（grsai）
option.fitting_img2img = {
  url: "https://grsai.dakka.com.cn/v1/draw/completions",
  api_key: "sk-80b8264413c54419b0e1ee795519c923",  // ← 请替换为你的 grsai API Key
  model: "gpt-image-2",
};

// 火山方舟图片理解接口（AI 自动分类用）
option.volcengine = {
  url: "https://ark.cn-beijing.volces.com/api/v3/responses",
  api_key: process.env.VOLCENGINE_API_KEY || "",
  model: process.env.VOLCENGINE_MODEL || "doubao-seed-2-0-pro-260215",
};

// DeepSeek LLM 接口（穿搭推荐用）
option.deepseek = {
  url: "https://api.deepseek.com/chat/completions",
  api_key: "sk-d6d6030881f442ba94f3548433c86548",  // ← 请替换为你的 DeepSeek API Key
  model: "deepseek-chat",
};

// 兼容旧代码
option.url = option.text2img.url;
option.api_key = option.text2img.api_key;
option.body = option.text2img.body;

module.exports = option
