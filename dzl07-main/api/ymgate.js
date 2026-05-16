// 一门APP在线网关 - 完全还原 ymgate.php 逻辑
// Vercel Edge Function

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // PHP文件中嵌入的认证信息
  const xYmUser = 'u495126.5cb2b8bcb0d2bb0839c9a595f2a39e5040baed34';
  const xYmVer = 'PHPv20250415';

  // 构建目标URL - 完全按照PHP逻辑：总是发送到 /ymgate/? + query_string
  // PHP: "http://gate.open.yimenyun.com/ymgate/?" . $_SERVER['QUERY_STRING']
  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const targetUrl = `http://gate.open.yimenyun.com/ymgate/${queryString ? '?' + queryString : ''}`;

  // 构建转发请求头 - 精确匹配PHP的 $headers 数组 + User-Agent
  const headers = new Headers();
  headers.set('X-Ym-User', xYmUser);
  headers.set('X-Ym-Ver', xYmVer);
  headers.set('User-Agent', request.headers.get('User-Agent') || '');

  try {
    const fetchOptions = {
      method: request.method,
      headers: headers,
      redirect: 'manual',  // 等同于 CURLOPT_FOLLOWLOCATION = 0
    };

    // 处理POST请求 - 匹配PHP的 CURLOPT_POST + CURLOPT_POSTFIELDS
    if (request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || '';
      if (contentType.includes('multipart/form-data')) {
        fetchOptions.body = await request.formData();
      } else {
        fetchOptions.body = await request.arrayBuffer();
        if (contentType) headers.set('Content-Type', contentType);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // 构建响应头 - 只转发 Content-Type 和 Location，匹配PHP行为
    const responseHeaders = new Headers();
    
    // 转发 Content-Type - 匹配 PHP: if (!empty($contentType)) header("Content-Type: " . $contentType);
    const respContentType = response.headers.get('Content-Type');
    if (respContentType) {
      responseHeaders.set('Content-Type', respContentType);
    }

    // 处理重定向 - 匹配 PHP: if (!empty($redirectUrl)) header("Location: " . $redirectUrl);
    // PHP的 CURLINFO_REDIRECT_URL 返回绝对URL
    // Fetch API的 redirect:'manual' 时，Location头可能是相对路径，需要转换为绝对路径
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (location) {
        if (location.startsWith('http://') || location.startsWith('https://')) {
          responseHeaders.set('Location', location);
        } else if (location.startsWith('//')) {
          responseHeaders.set('Location', `http:${location}`);
        } else if (location.startsWith('/')) {
          responseHeaders.set('Location', `http://gate.open.yimenyun.com${location}`);
        } else {
          responseHeaders.set('Location', `http://gate.open.yimenyun.com/ymgate/${location}`);
        }
      }
    }

    const body = await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    // 匹配PHP的错误处理：curl_errno时返回500 + 错误信息
    return new Response(error.message || 'Gateway Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
