import crypto from 'node:crypto';
import { cloudCall, cloudEnabled } from './cloud.js';
import { canDeleteContent } from './policies.js';
export function mountFeatures({app,io,db,authenticate,saveDB,isAdmin,persistFile,uploadAttachment,removeStoredFile,safeUser,enforceSpam,addLog,isListed}) {
  const route = (fn) => async (req,res,next) => { try { await fn(req,res); } catch(error) { next(error); } };
  const convoFor=(id,userId)=>db.conversations.find(c=>c.id===id&&c.members.includes(userId));
  app.get('/api/media/*',authenticate,route(async(req,res)=>{
    const key=req.params[0];const url='/api/media/'+key;
    const reel=db.reels.find(r=>r.videoUrl===url); const avatar=db.users.some(u=>u.profilePicture===url);
    const message=db.messages.find(m=>!m.deletedAt && m.attachment?.url===url);
    const allowed=avatar || (reel && (reel.moderationStatus==='approved'||!reel.moderationStatus||(reel.userId===req.user.id&&reel.moderationStatus!=='blocked')||await isAdmin(req.user))) || (message&&convoFor(message.conversationId,req.user.id));
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
    await saveDB();io.emit('reel:deleted',{id:reel.id});res.json({success:true});
  }));
  // Denpher global remove means content moderation, not deleting other people's accounts.
  app.get('/api/calls/config',authenticate,(_req,res)=>{
    const iceServers=[{urls:(process.env.STUN_URL||'stun:stun.l.google.com:19302').split(',').map(s=>s.trim()).filter(Boolean)}];
    if(process.env.TURN_URL&&process.env.TURN_USERNAME&&process.env.TURN_PASSWORD)iceServers.push({urls:process.env.TURN_URL.split(','),username:process.env.TURN_USERNAME,credential:process.env.TURN_PASSWORD});
    res.set('Cache-Control','no-store').json({iceServers,turnConfigured:iceServers.some(s=>s.username)});
  });
  const calls=new Map();
  io.on('connection',socket=>{
    const userId=socket.user.id;
    const end=(call,reason)=>{clearTimeout(call.timer);calls.delete(call.id);for(const id of call.members)io.to(`user:${id}`).emit('call:end',{callId:call.id,reason});};
    socket.on('call:invite',(payload={},callback)=>{
      const ack=typeof callback==='function'?callback:()=>{};const conversation=convoFor(payload?.conversationId,userId);
      if(!conversation||conversation.members.length!==2)return ack({error:'Call not allowed.'});
      if([...calls.values()].some(c=>c.members.some(id=>conversation.members.includes(id))))return ack({error:'Someone is already on a call.'});
      const id=crypto.randomUUID();const target=conversation.members.find(id=>id!==userId);
      if(!isListed(db.users.find(u=>u.id===target)))return ack({error:'This account is unavailable.'});
      if(!io.sockets.adapter.rooms.has(`user:${target}`))return ack({error:'This person is offline.'});
      const video=payload?.video===true;
      const call={id,members:conversation.members,caller:userId,conversationId:conversation.id,status:'ringing',video,sockets:new Set([socket.id])};calls.set(id,call);call.timer=setTimeout(()=>end(call,'No answer'),45000);
      io.to(`user:${target}`).emit('call:incoming',{callId:id,conversationId:conversation.id,video,caller:safeUser(socket.user,target)});ack({callId:id,video});
    });
    socket.on('call:accept',(payload={})=>{
      const call=calls.get(payload?.callId);if(!call||!call.members.includes(userId)||call.caller===userId||call.status!=='ringing')return;
      clearTimeout(call.timer);call.status='accepted';call.startedAt=Date.now();call.sockets.add(socket.id);io.to(`user:${call.caller}`).emit('call:accepted',{callId:call.id});
    });
    socket.on('call:signal',(payload={})=>{
      const call=calls.get(payload?.callId);if(!call||!call.members.includes(userId)||call.status!=='accepted')return;
      const signal=payload.signal;if(!signal||JSON.stringify(signal).length>100000)return;
      if(!['offer','answer','candidate'].includes(signal.type))return;
      if(signal.type!=='candidate'&&typeof signal.sdp!=='string')return;
      const other=call.members.find(id=>id!==userId);io.to(`user:${other}`).emit('call:signal',{callId:call.id,signal});
    });
    socket.on('call:end',(payload={})=>{const call=calls.get(payload?.callId);if(call&&call.members.includes(userId))end(call,call.status==='ringing'&&call.caller!==userId?'Call declined':'Call ended');});
    socket.on('disconnect',()=>{for(const call of calls.values())if(call.sockets.has(socket.id))end(call,'Connection lost');});
  });
}
