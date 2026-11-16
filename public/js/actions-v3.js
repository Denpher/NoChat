import { api } from '../services/api.js';

export function toggleMediaSound(media, button) {
  if (!media || !button) return null;
  if (media.tagName === 'VIDEO') {
    media.muted = !media.muted;
    button.setAttribute('aria-pressed', String(!media.muted));
    button.textContent = media.muted ? 'Sound Off' : 'Sound On';
    return !media.muted;
  }
  if (media.tagName === 'IFRAME') {
    const nextMuted = button.dataset.muted !== 'true';
    const send = func => media.contentWindow?.postMessage(JSON.stringify({event:'command',func,args:[]}), 'https://www.youtube.com');
    send(nextMuted ? 'mute' : 'unMute');
    if (!nextMuted) { media.contentWindow?.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[100]}), 'https://www.youtube.com'); setTimeout(()=>send('unMute'),120); }
    button.dataset.muted=String(nextMuted); button.setAttribute('aria-pressed',String(!nextMuted)); button.textContent=nextMuted?'Sound Off':'Sound On';
    return !nextMuted;
  }
  return null;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const permalink = id => `${location.origin}/#/home/${encodeURIComponent(id)}`;

function closeSheet() { document.querySelector('.v3-action-backdrop')?.remove(); }
function showSheet(html) {
  closeSheet();
  document.body.insertAdjacentHTML('beforeend', `<div class="v3-action-backdrop" data-action="v3-close-sheet"><section class="v3-action-sheet" role="dialog" aria-modal="true">${html}</section></div>`);
}
function copyLink(url, toast) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(url).then(() => toast('Link Copied!')).catch(() => manualCopy(url, toast));
  manualCopy(url, toast);
}
function manualCopy(url, toast) {
  showSheet(`<h3>Copy this link</h3><input class="v3-selectable-link" readonly value="${esc(url)}"><button type="button" data-action="v3-copy-manual" class="btn btn-primary">Copy Link</button><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Close</button>`);
  const input=document.querySelector('.v3-selectable-link'); input?.focus(); input?.select();
}
function openShare(id, state) {
  if (!id) return;
  const url=permalink(id);
  const chats=state.conversations || [];
  showSheet(`<h3>Share this post</h3><p class="v3-share-url">${esc(url)}</p><div class="v3-share-grid"><button type="button" data-action="v3-share-whatsapp" data-url="${esc(url)}">WhatsApp</button><button type="button" data-action="v3-share-telegram" data-url="${esc(url)}">Telegram</button><button type="button" data-action="v3-copy-link" data-url="${esc(url)}">Copy Link</button><button type="button" data-action="v3-share-native" data-url="${esc(url)}">More…</button></div><div class="v3-share-chat"><select data-share-conversation>${chats.map(c=>`<option value="${esc(c.id)}">${esc(c.otherUser?.displayName||c.otherUser?.username||'Chat')}</option>`).join('')}</select><button type="button" data-action="v3-share-chat" data-reel-id="${esc(id)}" ${chats.length?'':'disabled'}>Share to Chat</button></div><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Done</button>`);
}
function confirmDelete(id, kind) {
  showSheet(`<h3>Delete this ${kind}?</h3><p>This can't be undone.</p><div class="v3-confirm-actions"><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Cancel</button><button type="button" data-action="v3-confirm-delete" data-id="${esc(id)}" class="btn btn-danger">Delete</button></div>`);
}
function feedback(toast) { toast(''); }
async function normalizeAvatar(file) {
  if(file.type==='image/gif')return file;
  let image,objectUrl='';try{if(typeof createImageBitmap==='function')image=await createImageBitmap(file);else{objectUrl=URL.createObjectURL(file);image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=objectUrl;});}}catch{if(objectUrl)URL.revokeObjectURL(objectUrl);throw new Error('This photo format is not browser-compatible. Choose or save it as JPG or PNG.');}
  const scale=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');if(!ctx){image.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);throw new Error('Could not prepare this photo.');}ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw new Error('Could not convert this photo.');return new File([blob],`${file.name.replace(/\.[^.]+$/,'')||'avatar'}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
}

export function installActionsV3({ getState, toast, onDelete, onAvatarUpdated, onChatDeleted }) {
  if (document.documentElement.dataset.v3Actions) return;
  document.documentElement.dataset.v3Actions='1';
  document.addEventListener('click', async event => {
    const button=event.target.closest('[data-action]'); if(!button) return;
    const action=button.dataset.action;
    console.debug('[NoChat action]', action);
    button.classList.add('v3-click-feedback'); setTimeout(()=>button.classList.remove('v3-click-feedback'),180);
    const state=getState();
    if (action==='share-post'||action==='reel-share') { event.preventDefault(); openShare(button.closest('[data-reel-id]')?.dataset.reelId||button.closest('[data-post-id]')?.dataset.postId,state); }
    if (action==='v3-close-sheet') { if(event.target===button || event.target.classList.contains('v3-action-backdrop')) closeSheet(); }
    if (action==='v3-copy-link') copyLink(button.dataset.url,toast);
    if (action==='v3-copy-manual') { const input=document.querySelector('.v3-selectable-link'); input?.select(); try { if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(input.value); toast('Link Copied!'); } catch { toast('Link selected — copy it manually'); } }
    if (action==='v3-share-whatsapp'||action==='v3-share-telegram') { const url=encodeURIComponent(button.dataset.url); const target=action==='v3-share-whatsapp'?`https://wa.me/?text=${url}`:`https://t.me/share/url?url=${url}`; window.open(target,'_blank','noopener,noreferrer'); toast('Shared!'); if(navigator.vibrate) navigator.vibrate(50); }
    if (action==='v3-share-native') { try { await navigator.share({title:'NoChat post',url:button.dataset.url}); toast('Shared!'); if(navigator.vibrate) navigator.vibrate(50); } catch(e) { if(e.name!=='AbortError') copyLink(button.dataset.url,toast); } }
    if (action==='v3-share-chat') { const conversationId=document.querySelector('[data-share-conversation]')?.value; try { await api.post(`/api/conversations/${encodeURIComponent(conversationId)}/share-reel`,{reelId:button.dataset.reelId}); closeSheet(); toast('Shared to Chat!'); } catch(e) { toast(e.status===401?'Login again':`Share failed: ${e.message}`); } }
    if (action==='delete-full-chat') { const id=button.closest('.chat-main')?.querySelector('[data-action="start-video-call"]')?.dataset.conversationId || getState().activeConvo?.id; if(id) showSheet(`<h3>Delete this full chat?</h3><p>This removes the conversation and its old messages from your chat list. The other person keeps their copy.</p><div class="v3-confirm-actions"><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Cancel</button><button type="button" data-action="v3-confirm-chat-delete" data-id="${esc(id)}" class="btn btn-danger">Delete chat</button></div>`); }
    if (action==='v3-confirm-chat-delete') { const id=button.dataset.id; button.disabled=true; try { await api.post(`/api/conversations/${encodeURIComponent(id)}/hide`); closeSheet(); onChatDeleted?.(id); toast('Chat deleted for you'); } catch(e) { button.disabled=false; toast(e.status===401?'Login again':'Chat delete failed: '+e.message); } }
    if (action==='delete-post'||action==='delete-reel') { const card=button.closest('[data-post-id],[data-reel-id]'); confirmDelete(card?.dataset.postId||card?.dataset.reelId,action==='delete-reel'?'reel':'post'); }
    if (action==='delete-comment') { const item=button.closest('.comment-item'); const id=item?.dataset.commentId; const reelId=item?.dataset.reelId; try { await api.delete(`/api/reels/${encodeURIComponent(reelId)}/comments/${encodeURIComponent(id)}`); item.classList.add('v3-removing'); setTimeout(()=>item.remove(),220); toast('Comment deleted'); } catch(e) { toast(e.status===401?'Login again':'Delete failed: '+e.message); } }
    if (action==='v3-confirm-delete') { const id=button.dataset.id; button.disabled=true; try { await api.post(`/api/reels/${encodeURIComponent(id)}/soft-delete`); closeSheet(); const el=document.querySelector(`[data-post-id="${CSS.escape(id)}"],[data-reel-id="${CSS.escape(id)}"]`); el?.classList.add('v3-removing'); setTimeout(()=>el?.remove(),240); onDelete?.(id); toast('Deleted'); } catch(e) { button.disabled=false; toast(e.status===401?'Login again':`Delete failed: ${e.message}`); } }
    if (action==='toggle-follow') { const userId=button.dataset.userId; if(userId && userId!==String(state.user?.id)) { button.disabled=true; try { const r=await api.post(`/api/users/${encodeURIComponent(userId)}/subscribe`); button.textContent=r.isSubscribed?'Following':'Follow'; button.classList.toggle('btn-secondary',r.isSubscribed); toast(r.isSubscribed?'Following':'Unfollowed'); } catch(e) { toast(e.status===401?'Login again':`Follow failed: ${e.message}`); } finally { button.disabled=false; } } }
    if (action==='bookmark-post'||action==='reel-save') { const id=button.closest('[data-post-id],[data-reel-id]')?.dataset.postId||button.closest('[data-reel-id]')?.dataset.reelId; if(id) { const key='nochat:saved-reels'; const items=JSON.parse(localStorage.getItem(key)||'[]'); const saved=items.includes(id); const next=saved?items.filter(x=>x!==id):[...items,id]; localStorage.setItem(key,JSON.stringify(next)); button.classList.toggle('active',!saved); toast(saved?'Removed from Saved':'Saved'); } }
    if (action==='theme-toggle') { const shell=document.querySelector('.shell'); const light=shell?.dataset.theme!=='light'; if(shell) shell.dataset.theme=light?'light':'dark'; localStorage.setItem('nochat:theme',light?'light':'dark'); button.setAttribute('aria-pressed',String(light)); }
    if (action==='edit-avatar') document.querySelector('#v3-avatar-input')?.click();
    if (action==='v3-avatar-submit') { const input=document.querySelector('#v3-avatar-input'); let file=input?.files?.[0]; if(!file) { toast('Choose an image first'); return; } button.disabled=true; try { file=await normalizeAvatar(file); const form=new FormData(); form.append('avatar',file,file.name); const r=await api.post('/api/profile/avatar',form); onAvatarUpdated?.(r.user); toast('Profile photo updated'); closeSheet(); } catch(e) { toast(e.status===401?'Login again':`Photo update failed: ${e.message}`); } finally { button.disabled=false; } }
    if (action==='v3-avatar-open') { showSheet(`<h3>Change profile photo</h3><input id="v3-avatar-input" type="file" accept="image/*"><button type="button" data-action="v3-avatar-submit" class="btn btn-primary">Upload photo</button><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Cancel</button>`); }
    if (action==='v3-edit-profile') { const user=state.user||{}; showSheet(`<h3>Edit profile</h3><form class="v3-profile-edit-form"><label>Display name<input name="displayName" maxlength="50" value="${esc(user.displayName||'')}" required></label><label>Bio<textarea name="bio" maxlength="200" rows="4">${esc(user.bio||'')}</textarea></label><button type="submit" class="btn btn-primary">Save changes</button><button type="button" data-action="v3-close-sheet" class="btn btn-secondary">Cancel</button></form>`); }
    if (action==='toggle-reel-sound'||action==='v4-story-sound') { const media=button.closest('.reel-item,.post-card,.v4-story-viewer')?.querySelector('video,iframe'); const on=toggleMediaSound(media,button); if(on!==null) toast(on?'Sound on':'Sound off'); }
    if (action==='v3-hug') { const heart=document.createElement('div'); heart.className='v3-hug-heart'; heart.textContent='💚'; button.closest('.chat-main')?.append(heart); setTimeout(()=>heart.remove(),900); toast('Sent a hug'); }
    if (action==='v3-mood') { const mood=button.dataset.mood; localStorage.setItem('nochat:mood',mood); button.closest('.v3-mood-picker')?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button)); toast(`Mood set: ${mood}`); }
    if (action==='v3-close-friend') { try { const result=await api.post(`/api/close-friends/${encodeURIComponent(button.dataset.userId)}`); button.classList.toggle('active',result.isCloseFriend); toast(result.isCloseFriend?'Added to Close Friends':'Removed from Close Friends'); } catch(e) { toast(e.status===401?'Login again':'Close Friends update failed: '+e.message); } }
  });
  document.addEventListener('submit', async event=>{
    if(!event.target.matches('.v3-profile-edit-form'))return;
    event.preventDefault(); const form=event.target; const submit=form.querySelector('[type="submit"]'); if(submit)submit.disabled=true;
    try { const result=await api.put('/api/profile',{displayName:form.displayName.value.trim(),bio:form.bio.value.trim()}); onAvatarUpdated?.(result.user); closeSheet(); toast('Profile updated'); }
    catch(error){toast(error.status===401?'Login again':'Profile update failed: '+error.message);}
    finally{if(submit?.isConnected)submit.disabled=false;}
  });
  document.addEventListener('click', async event=>{
    const button=event.target.closest('[data-action="v3-voice-record"]'); if(!button)return;
    event.preventDefault();
    if(button.dataset.recording==='true'){button.dataset.recorder?.state; window.__nochatVoiceRecorder?.stop(); return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Voice notes need microphone access in a secure browser');return;}
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream); const chunks=[]; window.__nochatVoiceRecorder=recorder; button.dataset.recording='true'; button.textContent='Stop recording'; toast('Recording voice note… tap again to send');
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      recorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());button.dataset.recording='false';toast('Voice note recording failed');};
      recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());button.dataset.recording='false';button.textContent='🎙 Voice';const convo=getState().activeConvo;if(!chunks.length||!convo)return;try{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});const ext=blob.type.includes('ogg')?'ogg':blob.type.includes('mp4')?'m4a':'webm';const file=new File([blob],`voice-note.${ext}`,{type:blob.type});const data=new FormData();data.append('file',file);const result=await api.post(`/api/conversations/${encodeURIComponent(convo.id)}/attachments`,data);const state=getState();if(result.message&&!state.messages.some(m=>String(m.id)===String(result.message.id)))state.messages.push(result.message);window.dispatchEvent(new Event('nochat:refresh-chat'));toast('Voice note sent');}catch(error){toast(error.status===401?'Login again':'Voice note failed: '+error.message);}};
      recorder.start();
    }catch(error){toast(error.name==='NotAllowedError'?'Allow microphone access to record a voice note':'Voice note failed: '+error.message);}
  });
}
