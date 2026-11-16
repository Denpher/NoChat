/**
 * NoChat v4 - API Service
 * Clean fetch wrapper for all REST endpoints with automatic JSON handling.
 */

export async function apiRequest(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const headers = { ...opts.headers };
  
  if (!isFormData && opts.body && typeof opts.body === 'object') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...opts,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Network request failed');
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (path, opts) => apiRequest(path, { method: 'GET', ...opts }),
  post: (path, body, opts) => apiRequest(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts) => apiRequest(path, { method: 'PUT', body, ...opts }),
  delete: (path, opts) => apiRequest(path, { method: 'DELETE', ...opts }),
};
