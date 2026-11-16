import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFile } from '../policies.js';

const file = (name, mimetype, bytes) => ({ originalname: name, mimetype, buffer: Buffer.from(bytes), size: bytes.length });

test('validates supported story photo signatures without relying on browser MIME metadata', () => {
  const jpeg = validateFile(file('camera.jpg', 'application/octet-stream', [0xff,0xd8,0xff,0x00]), 'attachments');
  assert.equal(jpeg.mimetype, 'image/jpeg');
  const png = validateFile(file('story.png', 'image/png', [137,80,78,71,13,10,26,10]), 'attachments');
  assert.equal(png.mimetype, 'image/png');
});

test('validates voice-note WebM and Ogg signatures', () => {
  assert.equal(validateFile(file('voice.webm', 'audio/webm', [0x1a,0x45,0xdf,0xa3]), 'attachments').mimetype, 'audio/webm');
  assert.equal(validateFile(file('voice.ogg', 'audio/ogg', Buffer.from('OggSdata')), 'attachments').mimetype, 'audio/ogg');
});

test('rejects mismatched or unsupported file contents clearly', () => {
  assert.throws(() => validateFile(file('story.jpg', 'image/jpeg', Buffer.from('<html>bad</html>')), 'attachments'), /not a valid image\/jpeg/);
  assert.throws(() => validateFile(file('story.heic', 'image/heic', Buffer.from('heic')), 'attachments'), /Unsupported file type/);
});
