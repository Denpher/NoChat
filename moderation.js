import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { cloudCall, cloudEnabled } from './cloud.js';
import { blockedText } from './policies.js';
// Samples are extracted on the server from the real uploaded file, never supplied by a browser.
// Published policy. Only these categories can lead to automatic removal.
export const MODERATION_POLICIES = Object.freeze([
  'Sexual content involving minors',
  'Sexual violence or non-consensual sexual content',
  'Graphic violence, gore or self-harm promotion',
  'Terrorism or violent extremism',
  'Hate speech or threats against protected groups'
]);
// Model decisions below this confidence are never auto-removed; they are quarantined for a human.
export const AUTO_REMOVE_CONFIDENCE = 0.9;
export function decideVerdict(result = {}) {
  const status = String(result.status || '').toLowerCase();
  const confidence = Number(result.confidence);
  const reason = String(result.reason || '').slice(0, 300);
  if (status === 'approved') return { status: 'approved', reason: reason || 'Automatic review passed', source: 'automatic-visual', confidence: Number.isFinite(confidence) ? confidence : null };
  if (status === 'blocked' && Number.isFinite(confidence) && confidence >= AUTO_REMOVE_CONFIDENCE)
    return { status: 'blocked', reason: reason || 'High-confidence policy violation', source: 'automatic-visual', confidence };
  // Uncertain, low-confidence or unknown answers: private quarantine for administrator review.
  return { status: 'pending', reason: reason || 'Needs administrator review', source: 'automatic-visual', confidence: Number.isFinite(confidence) ? confidence : null };
}
export async function reviewReel(file, caption) {
  if (blockedText(caption)) return { status: 'blocked', reason: 'Prohibited caption.', source: 'automatic-caption', confidence: 1 };
  if (!cloudEnabled) return { status: 'pending', reason: 'Automatic visual review unavailable. Requires administrator review.', source: 'none', confidence: null };
  try {
    const frames = await sampleFrames(file.buffer);
    if (!frames.length) return { status: 'pending', reason: 'Video could not be inspected.', source: 'automatic-visual', confidence: null };
    return decideVerdict(await cloudCall('moderate', { caption, frames, policies: MODERATION_POLICIES }));
  } catch { return { status: 'pending', reason: 'Automatic review unavailable. Requires administrator review.', source: 'none', confidence: null }; }
}
function sampleFrames(buffer) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-i','pipe:0','-vf','fps=1/5,scale=384:-2','-frames:v','12','-f','image2pipe','-vcodec','mjpeg','pipe:1'], { stdio: ['pipe','pipe','ignore'] });
    let size = 0; const chunks = [];
    const timer = setTimeout(() => { process.kill(); reject(new Error('Inspection timeout')); }, 30000);
    process.stdout.on('data', chunk => { size += chunk.length; if (size > 8*1024*1024) { process.kill(); reject(new Error('Inspection output too large')); } else chunks.push(chunk); });
    process.on('error', error => { clearTimeout(timer); reject(error); });
    process.on('close', code => {
      clearTimeout(timer); if (code !== 0) return reject(new Error('Invalid or unsupported video'));
      const data = Buffer.concat(chunks); const frames = []; let start = -1;
      for (let i=0;i<data.length-1;i++) { if(data[i]===255&&data[i+1]===216) start=i; if(data[i]===255&&data[i+1]===217&&start>=0) { frames.push('data:image/jpeg;base64,'+data.subarray(start,i+2).toString('base64')); start=-1; } }
      resolve(frames.slice(0,12));
    });
    process.stdin.on('error',()=>{}); process.stdin.end(buffer);
  });
}
