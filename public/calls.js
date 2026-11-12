// Genuine peer-to-peer WebRTC voice; only mark connected after ICE connects.
window.NoChatCalls = function(socket,api,toast) {
  let current=null,pc=null,stream=null,candidates=[],timer=null,config;
  const $=id=>document.getElementById(id);
  const signal=value=>socket.emit('call:signal',{callId:current.id,signal:value});
  function clean(){clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());pc?.close();pc=null;stream=null;current=null;candidates=[];$('callModal').classList.add('hidden');$('callAudio').srcObject=null;}
  function end(reason){if(current)socket.emit('call:end',{callId:current.id});clean();if(reason)toast(reason);}
  function show(label,incoming){$('callTitle').textContent=label;$('callStatus').textContent=incoming?'Incoming voice call':'Calling…';$('callAccept').classList.toggle('hidden',!incoming);$('callMute').classList.add('hidden');$('callModal').classList.remove('hidden');timer=setTimeout(()=>end('Call timed out'),60000);}
  async function setup(){
    if(!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia)throw new Error('Voice calling is unavailable in this browser. Open NoChat over HTTPS in a current browser.');
    config=await api('/api/calls/config');
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    pc=new RTCPeerConnection({iceServers:config.iceServers});stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.onicecandidate=e=>{if(e.candidate&&current)signal({type:'candidate',candidate:e.candidate.toJSON()});};
    pc.ontrack=e=>{$('callAudio').srcObject=e.streams[0];$('callAudio').play().catch(()=>{$('callStatus').textContent='Tap speaker to hear the call';});};
    pc.onconnectionstatechange=()=>{if(pc?.connectionState==='connected'){clearTimeout(timer);$('callStatus').textContent='Connected';$('callMute').classList.remove('hidden');}if(['failed','disconnected'].includes(pc?.connectionState))end(config.turnConfigured?'Call connection lost':'Could not connect. A TURN relay is needed for some networks.');};
  }
  $('callAccept').onclick=async()=>{try{await setup();socket.emit('call:accept',{callId:current.id});$('callAccept').classList.add('hidden');$('callStatus').textContent='Connecting…';}catch(e){end(e.name==='NotAllowedError'?'Microphone permission denied':e.message);}};
  $('callEnd').onclick=()=>end();
  $('callMute').onclick=()=>{const track=stream?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;$('callMute').setAttribute('aria-pressed',String(!track.enabled));$('callMute').textContent=track.enabled?'Mute':'Unmute';}};
  $('callSpeaker').onclick=()=>$('callAudio').play().catch(()=>toast('Audio playback unavailable.'));
  socket.on('call:incoming',data=>{if(current){socket.emit('call:end',{callId:data.callId});return;}current={id:data.callId};show(data.caller.displayName,true);if(navigator.vibrate)navigator.vibrate([150,100,150]);});
  socket.on('call:accepted',async data=>{if(data.callId!==current?.id)return;try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);signal({type:'offer',sdp:offer.sdp});$('callStatus').textContent='Connecting…';}catch(e){end(e.message);}});
  socket.on('call:signal',async data=>{if(data.callId!==current?.id||!pc)return;try{const s=data.signal;if(s.type==='candidate'){if(pc.remoteDescription)await pc.addIceCandidate(s.candidate);else candidates.push(s.candidate);return;}await pc.setRemoteDescription({type:s.type,sdp:s.sdp});for(const c of candidates)await pc.addIceCandidate(c);candidates=[];if(s.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);signal({type:'answer',sdp:answer.sdp});}}catch(e){end('Call connection failed.');}});
  socket.on('call:end',data=>{if(data.callId===current?.id){clean();toast(data.reason||'Call ended');}});
  socket.on('disconnect',()=>{if(current){clean();toast('Call disconnected.');}});
  return {end,async start(conversationId,name){if(current)return toast('A call is already active.');if(!socket.connected)return toast('Reconnect before calling.');try{await setup();socket.emit('call:invite',{conversationId},result=>{if(result?.error){clean();return toast(result.error);}current={id:result.callId};show(name,false);});}catch(e){clean();toast(e.name==='NotAllowedError'?'Microphone permission denied':e.message);}}};
};
