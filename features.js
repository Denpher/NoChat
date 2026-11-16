import crypto from 'node:crypto';
import { cloudCall, cloudEnabled } from './cloud.js';
import { canDeleteContent, canViewStory } from './policies.js';
import { buildIceConfig } from './turn.js';
export function mountFeatures({app,io,db,authenticate,saveDB,isAdmin,persistFile,uploadAttachment,removeStoredFile,safeUser,enforceSpam,addLog,isListed}) {
  const route = (fn) => async (req,res,next) => { try { await fn(req,res); } catch(error) { next(error); } };
  const convoFor=(id,userId)=>db.conversations.find(c=>c.id===id&&c.members.includes(userId));
  app.get('/api/media/*',authenticate,route(async(req,res)=>{
    const key=req.params[0];const url='/api/media/'+key;
    const reel=db.reels.find(r=>r.videoUrl===url); const avatar=db.users.some(u=>u.profilePicture===url);
    const story=db.reelUploads.find(r=>r?.kind==='nochat-story'&&r.mediaUrl===url);
    const storyVisible=canViewStory(story,req.user.id,db.reelUploads);
    const message=db.messages.find(m=>!m.deletedAt && m.attachment?.url===url);
    const groupPhoto=db.conversations.some(c=>c.type==='group'&&c.avatar===url&&c.members.includes(req.user.id));const video=(db.videos||[]).some(v=>!v.deletedAt&&(v.fileUrl===url||v.thumbnail===url));
    const allowed=avatar || groupPhoto || video || storyVisible || (reel && (reel.moderationStatus==='approved'||!reel.moderationStatus||(reel.userId===req.user.id&&reel.moderationStatus!=='blocked')||await isAdmin(req.user))) || (message&&convoFor(message.conversationId,req.user.id));
    if(!allowed)return res.status(404).json({error:'File not found.'});
    const result=await cloudCall('download-url',{key,download:req.query.download==='1'});
    res.set('Cache-Control','no-store');res.redirect(result.url);
  }));
  app.post('/api/conversations/:id/attachments',authenticate,uploadAttachment.single('file'),route(async(req,res)=>{
    const conversation=convoFor(req.params.id,req.user.id);
    if(!conversation)return res.status(404).json({error:'Conversation not found.'});
    if(!req.file)return res.status(400).json({error:'Choose a file.'});
    const spamBlock=await enforceSpam(req.user,'','attachment');if(spamBlock)return res.status(429).json(spamBlock);
    const url=await persistFile(req.file,'attachments',req.user.id);
    const message={id:crypto.randomUUID(),conversationId:conversation.id,senderId:req.user.id,senderDisplayName:req.user.displayName,senderUsername:req.user.username,text:'',attachment:{url,name:req.file.originalname.slice(0,160),size:req.file.size,type:req.file.mimetype},createdAt:new Date().toISOString()};
    db.messages.push(message);await saveDB();io.to(`conversation:${conversation.id}`).emit('message:new',message);
    for(const id of conversation.members)io.to(`user:${id}`).emit('conversation:update',{conversationId:conversation.id,message});
    res.status(201).json({message});
  }));
  app.delete('/api/conversations/:id/messages/:messageId',authenticate,route(async(req,res)=>{
    const conversation=convoFor(req.params.id,req.user.id);if(!conversation)return res.status(404).json({error:'Conversation not found.'});
    const message=db.messages.find(m=>m.conversationId===conversation.id&&m.id===req.params.messageId);
    if(!message)return res.status(404).json({error:'Message not found.'});
    if(message.senderId!==req.user.id)return res.status(403).json({error:'Only the sender can delete this message.'});
    const old=message.attachment?.url;message.text='';message.attachment=null;message.deletedAt=new Date().toISOString();await saveDB();
    if(old)await removeStoredFile(old);
    io.to(`conversation:${conversation.id}`).emit('message:deleted',{conversationId:conversation.id,messageId:message.id});
    res.json({success:true});
  }));
  app.post('/api/conversations/:id/unread',authenticate,route(async(req,res)=>{
    const conversation=convoFor(req.params.id,req.user.id);if(!conversation)return res.status(404).json({error:'Conversation not found.'});
    const received=db.messages.filter(m=>m.conversationId===conversation.id&&m.senderId!==req.user.id&&!m.deletedAt);
    if(received.length){conversation.lastRead??={};conversation.lastRead[req.user.id]=new Date(new Date(received.at(-1).createdAt).getTime()-1).toISOString();await saveDB();}
    res.json({success:true});
  }));
  app.post('/api/reels/:id/report',authenticate,route(async(req,res)=>{
    const reel=db.reels.find(r=>r.id===req.params.id);if(!reel)return res.status(404).json({error:'Reel not found.'});
    const reason=String(req.body.reason||'').trim().slice(0,500);if(reason.length<3)return res.status(400).json({error:'Please include a reason.'});
    if(!db.reports.some(r=>r.reelId===reel.id&&r.userId===req.user.id&&r.status==='open')){db.reports.push({id:crypto.randomUUID(),reelId:reel.id,userId:req.user.id,reason,status:'open',createdAt:new Date().toISOString()});await saveDB();}
    res.json({success:true});
  }));
  app.get('/api/admin/review',authenticate,route(async(req,res)=>{
    if(!await isAdmin(req.user))return res.status(403).json({error:'Not authorized.'});
    res.json({reels:db.reels.filter(r=>(r.moderationStatus&&r.moderationStatus!=='approved')||db.reports.some(x=>x.reelId===r.id&&x.status==='open')).map(r=>({...r,user:safeUser(db.users.find(u=>u.id===r.userId),req.user.id),reports:db.reports.filter(x=>x.reelId===r.id&&x.status==='open')}))});
  }));
  app.post('/api/admin/reels/:id/review',authenticate,route(async(req,res)=>{
    if(!await isAdmin(req.user))return res.status(403).json({error:'Not authorized.'});
    const reel=db.reels.find(r=>r.id===req.params.id);if(!reel)return res.status(404).json({error:'Reel not found.'});
    if(!['approved','blocked'].includes(req.body.status))return res.status(400).json({error:'Invalid decision.'});
    reel.moderationStatus=req.body.status;reel.moderationReason='Administrator review';
    addLog(db,{kind:'moderation',reelRef:reel.id,userId:reel.userId,decision:req.body.status,source:'administrator',reason:'Administrator review',actorId:req.user.id});
    addLog(db,{kind:'audit',actorId:req.user.id,actorUsername:req.user.username,action:`reel-${req.body.status}`,targetId:reel.userId,targetUsername:db.users.find(u=>u.id===reel.userId)?.username||null,outcome:'success',reelRef:reel.id});
    for(const report of db.reports.filter(r=>r.reelId===reel.id)){report.status='reviewed';report.reviewedAt=new Date().toISOString();}
    await saveDB();io.emit('reel:moderation-updated',{reelId:reel.id,status:reel.moderationStatus});res.json({success:true});
  }));
  // Denpher global remove means content moderation, not deleting other people's accounts.
  // STUN + TURN. Permanent TURN secrets never leave the server; see turn.js and TURN-SETUP.md.
  app.get('/api/calls/config',authenticate,route(async(req,res)=>{
    res.set('Cache-Control','no-store').json(await buildIceConfig({userId:req.user.id}));
  }));
  // WebRTC signaling is registered by server.js. A second call invite listener
  // here emitted duplicate incoming-call payloads and broke the caller identity.
}
