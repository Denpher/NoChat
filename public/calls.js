// Genuine peer-to-peer WebRTC voice and video calls over the existing Socket.IO signaling.
// The UI only says "Connected" after ICE actually connects.
window.NoChatCalls = function (socket, api, toast) {
  let current = null, pc = null, stream = null, candidates = [], ringTimer = null, tick = null, dropTimer = null, config = null, facing = 'user', iceRestarts = 0;
  const $ = (id) => document.getElementById(id);
  const signal = (value) => current && socket.emit('call:signal', { callId: current.id, signal: value });
  const setStatus = (t) => { $('callStatus').textContent = t; };
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  // Connection indicator: shows the real route ICE selected (relay = TURN, srflx = STUN, host = local).
  const net = (text, kind) => { $('callNetText').textContent = text; $('callNet').className = 'call-net ' + (kind || ''); };
  async function getConfig(force) {
    if (!force && config && (!config.turn?.expiresAt || Date.parse(config.turn.expiresAt) - Date.now() > 120000)) return config;
    config = await api('/api/calls/config'); return config;
  }
  async function describeRoute() {
    if (!pc) return;
    try {
      const stats = await pc.getStats(); let pair = null; const byId = new Map();
      stats.forEach((r) => { byId.set(r.id, r); if (r.type === 'transport' && r.selectedCandidatePairId) pair = r.selectedCandidatePairId; });
      let sel = pair ? byId.get(pair) : null;
      if (!sel) stats.forEach((r) => { if (r.type === 'candidate-pair' && (r.selected || (r.nominated && r.state === 'succeeded'))) sel = r; });
      const local = sel && byId.get(sel.localCandidateId), remote = sel && byId.get(sel.remoteCandidateId);
      if (!local) return net('Connected', 'ok');
      const relayed = local.candidateType === 'relay' || remote?.candidateType === 'relay';
      const proto = (local.relayProtocol || local.protocol || '').toUpperCase();
      if (relayed) net(`Connected via TURN relay${proto ? ' · ' + proto : ''}`, 'ok relay');
      else if (local.candidateType === 'srflx' || local.candidateType === 'prflx') net('Connected directly (STUN)', 'ok');
      else net('Connected directly (local network)', 'ok');
    } catch { net('Connected', 'ok'); }
  }

  function clean() {
    clearTimeout(ringTimer); clearInterval(tick); clearTimeout(dropTimer);
    stream?.getTracks().forEach((t) => t.stop());
    if (pc) { pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null; pc.close(); }
    pc = null; stream = null; current = null; candidates = []; facing = 'user'; iceRestarts = 0;
    $('callNet').classList.add('hidden');
    $('callRemoteVideo').srcObject = null; $('callLocalVideo').srcObject = null; $('callAudio').srcObject = null;
    $('callModal').classList.add('hidden'); $('callModal').classList.remove('is-video', 'is-live');
    $('callTimer').textContent = '';
  }
  function end(reason) { if (current) socket.emit('call:end', { callId: current.id }); clean(); if (reason) toast(reason); }

  function controls(incoming) {
    show('callAccept', incoming); show('callDecline', incoming); show('callEnd', !incoming);
    const live = Boolean(stream) && !incoming;
    show('callMute', live); show('callCamera', live && current?.video); show('callSwitch', live && current?.video && current.canSwitch);
  }
  function open(label, incoming) {
    $('callTitle').textContent = label;
    $('callKind').textContent = current.video ? 'Video call' : 'Voice call';
    setStatus(incoming ? `Incoming ${current.video ? 'video' : 'voice'} call` : 'Calling…');
    $('callAvatar').textContent = (label || '?').charAt(0).toUpperCase();
    $('callModal').classList.toggle('is-video', Boolean(current.video));
    $('callModal').classList.remove('hidden');
    controls(incoming);
    ringTimer = setTimeout(() => end(incoming ? 'Missed call' : 'No answer'), 60000);
  }
  function startTimer() {
    const started = Date.now(); clearInterval(tick);
    const draw = () => { const s = Math.floor((Date.now() - started) / 1000); $('callTimer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    draw(); tick = setInterval(draw, 1000);
  }

  async function getMedia(video) {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (!video) return navigator.mediaDevices.getUserMedia({ audio, video: false });
    try { return await navigator.mediaDevices.getUserMedia({ audio, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } }); }
    catch (e) {
      if (e.name === 'NotAllowedError') throw e;
      toast('Camera unavailable — continuing with voice only.');
      current.video = false; $('callModal').classList.remove('is-video');
      return navigator.mediaDevices.getUserMedia({ audio, video: false });
    }
  }
  async function setup(video) {
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) throw new Error('Calling is unavailable in this browser. Open NoChat over HTTPS in a current browser.');
    await getConfig();
    stream = await getMedia(video);
    const relay = config.turn?.status === 'ready';
    net(relay ? 'Relay ready (TURN ' + (config.turn.transports || []).join('/').toUpperCase() + ')' : config.turn?.status === 'unavailable' ? 'Relay unavailable — using STUN only' : 'No relay configured — STUN only', relay ? 'info' : 'warn');
    if (current?.video) {
      $('callLocalVideo').srcObject = stream;
      const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
      current.canSwitch = cams.length > 1;
    }
    pc = new RTCPeerConnection({ iceServers: config.iceServers, iceTransportPolicy: config.iceTransportPolicy || 'all', iceCandidatePoolSize: 4 });
    pc.oniceconnectionstatechange = () => { const st = pc?.iceConnectionState; if (st === 'checking') net('Finding the best network route…', 'info'); };
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (!current?.video) pc.addTransceiver('video', { direction: 'recvonly' });
    pc.onicecandidate = (e) => { if (e.candidate && current) signal({ type: 'candidate', candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const remote = e.streams[0]; if (!remote) return;
      $('callAudio').srcObject = remote; $('callAudio').play().catch(() => setStatus('Tap the speaker button to hear the call'));
      if (e.track.kind === 'video') { $('callRemoteVideo').srcObject = remote; $('callModal').classList.add('is-video'); }
    };
    pc.onconnectionstatechange = () => {
      const st = pc?.connectionState;
      if (st === 'connected') {
        clearTimeout(ringTimer); clearTimeout(dropTimer);
        if (!$('callModal').classList.contains('is-live')) { $('callModal').classList.add('is-live'); startTimer(); }
        setStatus('Connected'); controls(false); describeRoute();
      } else if (st === 'disconnected') {
        setStatus('Reconnecting…');
        try { pc.restartIce(); } catch { /* older browsers */ }
        clearTimeout(dropTimer); dropTimer = setTimeout(() => { if (pc?.connectionState !== 'connected') end('Call connection lost'); }, 15000);
      } else if (st === 'failed') {
        if (iceRestarts < 2) {
          iceRestarts++; setStatus('Reconnecting…'); net('Retrying with fresh relay credentials…', 'warn');
          getConfig(true).then((c) => { try { pc?.setConfiguration({ iceServers: c.iceServers, iceTransportPolicy: c.iceTransportPolicy || 'all' }); } catch { /* keep old config */ } })
            .catch(() => {}).finally(() => { try { pc?.restartIce(); } catch { end('Call connection failed.'); } });
        } else {
          end(config?.turn?.status === 'ready' ? 'Call connection failed, even through the relay. One of the networks may be blocking calls.' : 'Call connection failed. One of the networks may be blocking calls, and no TURN relay is configured.');
        }
      }
    };
  }
  const failMessage = (e) => e.name === 'NotAllowedError' ? 'Microphone or camera permission denied' : e.message;

  $('callAccept').onclick = async () => {
    try { await setup(current.video); socket.emit('call:accept', { callId: current.id }); controls(false); setStatus('Connecting…'); clearTimeout(ringTimer); ringTimer = setTimeout(() => end('Could not connect the call'), 30000); }
    catch (e) { end(failMessage(e)); }
  };
  $('callDecline').onclick = () => end('Call declined');
  $('callEnd').onclick = () => end();
  $('callMute').onclick = () => {
    const track = stream?.getAudioTracks()[0]; if (!track) return;
    track.enabled = !track.enabled;
    $('callMute').setAttribute('aria-pressed', String(!track.enabled));
    $('callMute').querySelector('span').textContent = track.enabled ? 'Mute' : 'Unmute';
  };
  $('callCamera').onclick = () => {
    const track = stream?.getVideoTracks()[0]; if (!track) return;
    track.enabled = !track.enabled;
    $('callCamera').setAttribute('aria-pressed', String(!track.enabled));
    $('callCamera').querySelector('span').textContent = track.enabled ? 'Camera off' : 'Camera on';
    $('callModal').classList.toggle('cam-off', !track.enabled);
  };
  $('callSwitch').onclick = async () => {
    const old = stream?.getVideoTracks()[0]; if (!old || !pc) return;
    const next = facing === 'user' ? 'environment' : 'user';
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false });
      const track = fresh.getVideoTracks()[0]; track.enabled = old.enabled;
      await pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(track);
      stream.removeTrack(old); old.stop(); stream.addTrack(track); facing = next;
      $('callLocalVideo').srcObject = stream;
    } catch { toast('Could not switch camera on this device.'); }
  };
  $('callSpeaker').onclick = () => $('callAudio').play().catch(() => toast('Audio playback unavailable.'));

  socket.on('call:incoming', (data) => {
    if (current) { socket.emit('call:end', { callId: data.callId }); return; }
    current = { id: data.callId, video: data.video === true };
    open(data.caller?.displayName || 'NoChat user', true);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
  });
  socket.on('call:accepted', async (data) => {
    if (data.callId !== current?.id || !pc) return;
    try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); signal({ type: 'offer', sdp: offer.sdp }); setStatus('Connecting…'); }
    catch (e) { end(e.message); }
  });
  socket.on('call:signal', async (data) => {
    if (data.callId !== current?.id || !pc) return;
    try {
      const s = data.signal;
      if (s.type === 'candidate') { if (pc.remoteDescription) await pc.addIceCandidate(s.candidate); else candidates.push(s.candidate); return; }
      await pc.setRemoteDescription({ type: s.type, sdp: s.sdp });
      for (const c of candidates) await pc.addIceCandidate(c);
      candidates = [];
      if (s.type === 'offer') { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); signal({ type: 'answer', sdp: answer.sdp }); }
    } catch { end('Call connection failed.'); }
  });
  socket.on('call:end', (data) => { if (data.callId === current?.id) { clean(); toast(data.reason || 'Call ended'); } });
  socket.on('disconnect', () => { if (current) { clean(); toast('Call disconnected.'); } });
  window.addEventListener('pagehide', () => { if (current) end(); });

  // Real TURN check from this browser: gather relay-only candidates and report which transports worked.
  async function testConnectivity() {
    const out = $('callTestResult'); const btn = $('callTestBtn');
    if (!window.RTCPeerConnection) { out.innerHTML = '<p class="test-bad">This browser does not support calls.</p>'; return; }
    btn.disabled = true; out.innerHTML = '<p class="muted small">Testing… this takes up to 10 seconds.</p>';
    try {
      const c = await getConfig(true);
      if (c.turn?.status !== 'ready') { out.innerHTML = `<p class="test-warn">${c.turn?.message || 'No TURN relay is configured.'}</p>`; return; }
      const test = new RTCPeerConnection({ iceServers: c.iceServers, iceTransportPolicy: 'relay' });
      const found = new Set(); test.createDataChannel('probe');
      test.onicecandidate = (e) => { const cand = e.candidate; if (!cand || !/ typ relay /.test(cand.candidate)) return; found.add((cand.relayProtocol || (/ tcp /i.test(cand.candidate) ? 'tcp' : 'udp')).toLowerCase()); };
      await test.setLocalDescription(await test.createOffer());
      await new Promise((r) => { const t = setTimeout(r, 10000); test.onicegatheringstatechange = () => { if (test.iceGatheringState === 'complete') { clearTimeout(t); r(); } }; });
      test.close();
      const want = c.turn.transports || [];
      out.innerHTML = want.map((t) => `<p class="${found.has(t) ? 'test-ok' : 'test-bad'}">TURN over ${t.toUpperCase()}: ${found.has(t) ? 'reachable' : 'not reachable from this network'}</p>`).join('')
        + (found.size ? '' : '<p class="test-bad">No relay candidates. Check the TURN server, credentials and firewall.</p>');
    } catch (e) { out.innerHTML = `<p class="test-bad">${e.message || 'Test failed.'}</p>`; }
    finally { btn.disabled = false; }
  }
  $('callTestBtn').onclick = testConnectivity;

  return {
    end, testConnectivity,
    async start(conversationId, name, video = false) {
      if (current) return toast('A call is already active.');
      if (!socket.connected) return toast('Reconnect before calling.');
      current = { id: null, video };
      try {
        await setup(video);
        socket.emit('call:invite', { conversationId, video: current.video }, (result) => {
          if (result?.error) { clean(); return toast(result.error); }
          current.id = result.callId; open(name, false);
          controls(false);
        });
      } catch (e) { clean(); toast(failMessage(e)); }
    }
  };
};
