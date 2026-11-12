import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { cloudCall, cloudEnabled } from './cloud.js';
import { blockedText } from './policies.js';
// Samples are extracted on the server from the real uploaded file, never supplied by a browser.
export async function reviewReel(file, caption) {
  if (blockedText(caption)) return { status: 'blocked', reason: 'Prohibited caption.' };
  if (!cloudEnabled) return { status: 'pending', reason: 'Cloud visual review unavailable.' };
  try {
    const frames = await sampleFrames(file.buffer);
    if (!frames.length) return { status: 'pending', reason: 'Video could not be inspected.' };
    return await cloudCall('moderate', { caption, frames });
  } catch { return { status: 'pending', reason: 'Automatic review unavailable. Requires administrator review.' }; }
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
