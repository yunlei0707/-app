// Edge Middleware 处理所有请求
export const config = {
  matcher: ['/ymgate/:path*', '/ymgate'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  
  // 只处理 /ymgate 路由
  if (!url.pathname.startsWith('/ymgate')) {
    return fetch(request);
  }
  
  // 获取用户ID和密钥
  const userId = '495126';
  const userSecret = 'TNvPWnZHeSQFdyyRzcNV2QzAfj2lwgLkwUbR3eKqPK9JkRu5';
  const xYmUser = `u${userId}.${userSecret}`;
  
  // 构建目标URL - 网关使用 http 协议和 /ymgate 路径
  const path = url.pathname.replace(/^\/ymgate/, '') || '/';
  const targetUrl = `http://gate.open.yimenyun.com/ymgate${path === '/' ? '' : path}${url.search}`;
  
  // 构建请求头
  const headers = new Headers();
  headers.set('X-Ym-User', xYmUser);
  headers.set('Content-Type', request.headers.get('content-type') || 'application/json');
  headers.set('User-Agent', request.headers.get('user-agent') || '');
  headers.set('Accept', request.headers.get('accept') || '*/*');
  
  // 转发请求到目标网关
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ? await request.text() : undefined,
    });
    
    // 获取响应
    const text = await response.text();
    
    // 返回响应
    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error) {
    console.error('网关代理错误:', error);
    return new Response(JSON.stringify({
      code: 500,
      message: '网关代理请求失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
