// One-time explicit migration; never seeds from page load or startup.
import 'dotenv/config';import fs from 'node:fs/promises';import path from 'node:path';
import {cloudCall,storeFile} from '../cloud.js';import {validateFile} from '../policies.js';
const file=process.argv[2];const uploads=process.argv[3];
if(!file||!uploads)throw new Error('Usage: npm run migrate:legacy -- /path/db.json /path/uploads');
const loaded=await cloudCall('load');
if(Object.values(loaded.state).some(rows=>rows.length))throw new Error('Cloud is not empty. Export a backup and use a reviewed merge; refusing to overwrite accounts.');
const state=JSON.parse(await fs.readFile(file,'utf8'));
const mime={'.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};
async function move(url,folder,userId){if(!url?.startsWith('/uploads/'))return url;const relative=url.slice('/uploads/'.length);const resolved=path.resolve(uploads,relative);if(!resolved.startsWith(path.resolve(uploads)+path.sep))throw new Error('Invalid legacy path');const originalname=path.basename(resolved);const buffer=await fs.readFile(resolved);return storeFile(validateFile({originalname,buffer,mimetype:mime[path.extname(resolved).toLowerCase()]},folder),folder,userId);}
for(const user of state.users||[])user.profilePicture=await move(user.profilePicture,'profile',user.id);
for(const reel of state.reels||[]){reel.videoUrl=await move(reel.videoUrl,'reels',reel.userId);reel.moderationStatus='pending';reel.moderationReason='Legacy import requires review';}
await cloudCall('save',{revision:loaded.revision,state});console.log('Legacy records and files migrated. Originals unchanged. Review imported reels before publication.');
