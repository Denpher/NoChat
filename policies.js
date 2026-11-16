import path from 'node:path';
export const DEFAULT_REEL_LIMIT = 2;
export function reelLimit(value = process.env.DAILY_REEL_LIMIT) { const n = Number(value ?? DEFAULT_REEL_LIMIT); if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('DAILY_REEL_LIMIT must be between 1 and 100.'); return n; }
export function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
export function canDeleteContent(ownerId, actorId, admin) { return ownerId === actorId || admin === true; }
export function unseen(message, conversation, readerId) { return !message.system && message.senderId !== readerId && !message.deletedAt && message.createdAt > (conversation.lastRead?.[readerId] || ''); }
export function seenAt(message, conversation) { const other = conversation.members.find(id => id !== message.senderId); const last = conversation.lastRead?.[other]; return last && last >= message.createdAt ? last : null; }
export function blockedText(value) {
  const text = String(value || '').normalize('NFKC').toLowerCase();
  return /\b(?:child porn(?:ography)?|csam|kill all (?:muslims|jews|hindus|christians)|rape (?:her|him|them))\b/.test(text);
}
const TYPES = {
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif',
  '.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm',
  '.pdf':'application/pdf','.txt':'text/plain','.doc':'application/msword',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
export function validateFile(file, kind) {
  const ext = path.extname(file.originalname).toLowerCase(); const mime = TYPES[ext]; const b = file.buffer;
  const limit = (kind === 'reels' ? 100 : kind === 'profile' ? 10 : 20) * 1024 * 1024;
  if (!b || !b.length || b.length > limit || !mime || mime !== file.mimetype) throw new Error('Unsupported file type or file exceeds its size limit.');
  if (kind === 'profile' && !mime.startsWith('image/')) throw new Error('Choose an image.');
  if (kind === 'reels' && !mime.startsWith('video/')) throw new Error('Choose MP4, MOV or WebM.');
  let valid = false;
  if (mime === 'image/jpeg') valid = b[0]===255 && b[1]===216 && b[2]===255;
  else if (mime === 'image/png') valid = b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  else if (mime === 'image/gif') valid = /^GIF8[79]a$/.test(b.subarray(0,6).toString());
  else if (mime === 'image/webp') valid = b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WEBP';
  else if (mime === 'video/mp4' || mime === 'video/quicktime') valid = b.subarray(4,8).toString()==='ftyp';
  else if (mime === 'video/webm') valid = b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
  else if (mime === 'application/pdf') valid = b.subarray(0,5).toString()==='%PDF-';
  else if (mime === 'text/plain') valid = !b.includes(0) && !/<\s*(?:script|html|svg)\b/i.test(b.toString('utf8'));
  else if (['.docx','.xlsx','.pptx'].includes(ext)) valid = b.subarray(0,4).equals(Buffer.from([80,75,3,4])) && b.includes(Buffer.from('[Content_Types].xml')) && !b.includes(Buffer.from('vbaProject.bin'));
  else valid = b.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
  if (!valid) throw new Error('File contents do not match its declared type.');
  return { ...file, extension: ext };
}
