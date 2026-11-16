import {test} from 'node:test';import assert from 'node:assert/strict';
import {reelLimit,dayKey,canDeleteContent,unseen,seenAt,validateFile,blockedText} from '../policies.js';
test('default upload limit is exactly two reels per user per UTC day',()=>{assert.equal(reelLimit(undefined),2);assert.equal(dayKey(new Date('2026-11-12T23:59:59Z')),'2026-11-12');assert.equal(dayKey(new Date('2026-11-13T00:00:00Z')),'2026-11-13');});
test('configured reel limit is validated on the server',()=>{assert.equal(reelLimit('3'),3);assert.throws(()=>reelLimit('0'));assert.throws(()=>reelLimit('bad'));});
test('only content owner or authorized admin can remove reels and comments',()=>{assert.equal(canDeleteContent('owner','other',false),false);assert.equal(canDeleteContent('owner','owner',false),true);assert.equal(canDeleteContent('owner','denpher',true),true);});
test('messages remain unseen until recipient actually marks read',()=>{const m={senderId:'a',createdAt:'2026-11-12T05:00:00Z'};const c={members:['a','b'],lastRead:{}};assert.equal(unseen(m,c,'b'),true);assert.equal(seenAt(m,c),null);c.lastRead.b='2026-11-12T05:01:00Z';assert.equal(unseen(m,c,'b'),false);assert.equal(seenAt(m,c),c.lastRead.b);});
test('spoofed file content is rejected even with allowed MIME and extension',()=>{assert.throws(()=>validateFile({originalname:'reel.mp4',mimetype:'video/mp4',buffer:Buffer.from('<script>bad</script>')},'reels'));});
test('attachment size restriction is exactly 20 MB',()=>{assert.throws(()=>validateFile({originalname:'file.txt',mimetype:'text/plain',buffer:Buffer.alloc(20*1024*1024+1,65)},'attachments'));});
test('clear prohibited violent captions are blocked before publishing',()=>{assert.equal(blockedText('kill all hindus'),true);assert.equal(blockedText('a lovely sunset'),false);});
