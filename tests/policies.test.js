import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, canViewReel, canViewStory } from '../policies.js';

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

test('validates Reel MP4 contents from the file signature', () => {
  const mp4Bytes = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from('ftypisom'), Buffer.alloc(16)]);
  assert.equal(validateFile(file('upload.mp4', 'application/octet-stream', mp4Bytes), 'reels').mimetype, 'video/mp4');
  assert.throws(() => validateFile(file('fake.mp4', 'video/mp4', Buffer.from('not a video')), 'reels'), /not a valid video\/mp4/);
});

test('rejects mismatched or unsupported file contents clearly', () => {
  assert.throws(() => validateFile(file('story.jpg', 'image/jpeg', Buffer.from('<html>bad</html>')), 'attachments'), /not a valid image\/jpeg/);
  assert.throws(() => validateFile(file('story.heic', 'image/heic', Buffer.from('heic')), 'attachments'), /Unsupported file type/);
});

test('pending reels are visible only to their creator until approved', () => {
  const pending = { id: 'r1', userId: 21, moderationStatus: 'pending' };
  assert.equal(canViewReel(pending, 21), true);
  assert.equal(canViewReel(pending, '21'), true);
  assert.equal(canViewReel(pending, 2), false);
  assert.equal(canViewReel({ ...pending, moderationStatus: 'approved' }, 2), true);
  assert.equal(canViewReel({ ...pending, moderationStatus: 'blocked' }, 21), false);
  assert.equal(canViewReel({ ...pending, isDeleted: true }, 21), false);
});

test('story media access respects expiry and Close Friends visibility', () => {
  const now=Date.now();
  const closeOnly={id:'s1',kind:'nochat-story',userId:21,closeFriendsOnly:true,expiresAt:now+10000};
  const friends=[{kind:'nochat-close-friend',userId:21,friendUserId:2}];
  assert.equal(canViewStory(closeOnly,21,friends,now),true);
  assert.equal(canViewStory(closeOnly,2,friends,now),true);
  assert.equal(canViewStory(closeOnly,3,friends,now),false);
  assert.equal(canViewStory({...closeOnly,closeFriendsOnly:false},3,[],now),true);
  assert.equal(canViewStory({...closeOnly,expiresAt:now-1},2,friends,now),false);
  assert.equal(canViewStory({...closeOnly,isDeleted:true},21,friends,now),false);
});
