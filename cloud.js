// Server-only bridge. No privileged database key ever leaves Lovable Cloud.
export const cloudEnabled = Boolean(process.env.NOCHAT_CLOUD_URL && process.env.NOCHAT_BRIDGE_SECRET);
export async function cloudCall(operation, data = {}) {
  if (!cloudEnabled) throw new Error('Permanent cloud storage is not configured.');
  const response = await fetch(process.env.NOCHAT_CLOUD_URL.replace(/\/$/, '') + '/api/public/nochat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NOCHAT_BRIDGE_SECRET}` },
    body: JSON.stringify({ operation, ...data }), signal: AbortSignal.timeout(90000)
  });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : {}; }
  catch { const error = new Error('Cloud bridge returned non-JSON response (HTTP ' + response.status + '): ' + raw.slice(0,300)); error.status = response.status; throw error; }
  if (!response.ok) { const error = new Error(result.error || 'Cloud storage unavailable. Please try again.'); error.status = response.status; throw error; }
  return result;
}
export async function storeFile(file, folder, userId) {
  const key = `${folder}/${userId}/${crypto.randomUUID()}${file.extension}`;
  const { url } = await cloudCall('upload-url', { key });
  const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.mimetype }, body: file.buffer, signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error('Permanent file upload failed.');
  return '/api/media/' + key;
}
