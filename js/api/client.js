import { API, isDev } from '../core/config.js';
import { getInitData } from '../services/telegram.js';

export class ApiError extends Error {
  constructor(type, message, meta = {}) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    Object.assign(this, meta);
  }
}

function buildUrl(path, query) {
  let url = /^https?:/.test(path) ? path : `${API.baseUrl}${path}`;

  if (query) {
    const entries = Object.entries(query).filter(([, v]) => v != null);
    const qs = new URLSearchParams(entries).toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  return url;
}

function buildHeaders(extra = {}) {
  const headers = { Accept: 'application/json', ...extra };
  const initData = getInitData();
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  return headers;
}

async function parseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      throw new ApiError('parse', 'Invalid JSON response', { status: response.status });
    }
  }
  return response.text();
}

function isRetryable(method, type) {
  return method === 'GET' && (type === 'network' || type === 'timeout');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function request(path, {
  method = 'GET',
  body = null,
  query = null,
  headers: extraHeaders = {},
  timeout = API.timeout,
  signal: externalSignal = null
} = {}) {
  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers = buildHeaders(extraHeaders);
    let payload = null;

    if (body !== null && body !== undefined) {
      if (body instanceof FormData) {
        payload = body;
      } else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }

    const url = buildUrl(path, query);
    let response;

    try {
      response = await fetch(url, { method, headers, body: payload, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ApiError('timeout', 'Request timed out', { url, method });
      }
      throw new ApiError('network', 'Network request failed', { url, method, cause: err });
    } finally {
      clearTimeout(timer);
    }

    const data = await parseBody(response);

    if (!response.ok) {
      throw new ApiError('http', data?.message || `HTTP ${response.status}`, {
        status: response.status,
        url,
        payload: data
      });
    }

    return data;
  };

  const { attempts, delayMs } = API.retry;
  let lastError;

  for (let i = 0; i <= attempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (!isRetryable(method, err.type) || i === attempts) throw err;
      if (isDev()) console.warn(`[api] Retry ${i + 1}/${attempts} for ${path}`);
      await sleep(delayMs * (i + 1));
    }
  }

  throw lastError;
}

export async function upload(path, formData, { timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers = buildHeaders();
  // Do NOT set Content-Type — the browser adds the multipart boundary.

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('timeout', 'Upload timed out');
    }
    throw new ApiError('network', 'Upload failed', { cause: err });
  } finally {
    clearTimeout(timer);
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError('http', data?.message || `HTTP ${response.status}`, {
      status: response.status,
      payload: data
    });
  }

  return data;
}

export const get   = (path, opts = {})       => request(path, { ...opts, method: 'GET' });
export const post  = (path, body, opts = {}) => request(path, { ...opts, method: 'POST', body });
export const put   = (path, body, opts = {}) => request(path, { ...opts, method: 'PUT', body });
export const patch = (path, body, opts = {}) => request(path, { ...opts, method: 'PATCH', body });
export const del   = (path, opts = {})       => request(path, { ...opts, method: 'DELETE' });
