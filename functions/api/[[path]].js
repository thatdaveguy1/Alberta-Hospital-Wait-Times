// Pages Function — proxies /api/* requests to the Cloudflare Worker.
// This lets the Pages frontend use relative /api/* URLs that get forwarded
// to the Worker which reads from KV.

const WORKER_URL = 'https://alberta-hospital-wait-times.longmad.workers.dev';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const workerUrl = `${WORKER_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Origin', WORKER_URL);

  const response = await fetch(workerUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Push-Signature, X-Push-Timestamp');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
