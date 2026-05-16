// 一门APP在线网关代理 - Vercel Serverless Function
// 用于接收一门APP的版本推送等在线功能请求

export default async function handler(req, res) {
  // 获取用户ID和密钥
  const userId = process.env.YM_USER_ID || '495126';
  const userSecret = process.env.YM_USER_SECRET || 'TNvPWnZHeSQFdyyRzcNV2QzAfj2lwgLkwUbR3eKqPK9JkRu5';
  const xYmUser = `u${userId}.${userSecret}`;

  // 构建目标URL - 网关使用 http 协议和 /ymgate 路径
  const urlPath = req.url?.replace(/^\/ymgate/, '') || '/';
  const targetUrl = `http://gate.open.yimenyun.com/ymgate${urlPath === '/' ? '' : urlPath}`;

  // 构建转发请求头
  const headers = new Headers();
  headers.set('X-Ym-User', xYmUser);
  headers.set('Content-Type', req.headers['content-type'] || 'application/json');
  
  // 复制其他必要的请求头
  const excludeHeaders = ['host', 'content-length', 'connection'];
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (!excludeHeaders.includes(key.toLowerCase()) && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  try {
    // 发起请求到目标网关
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: headers,
    });

    // 获取响应内容
    const text = await response.text();

    // 设置响应头
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain; charset=utf-8');
    
    // 返回响应内容
    res.status(response.status).send(text);

  } catch (error) {
    console.error('网关代理错误:', error);
    res.status(500).json({ 
      code: 500, 
      message: '网关代理请求失败',
      error: error.message
    });
  }
}
