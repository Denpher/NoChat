/**
 * NoChat v4 - Webcam Video Calling Modal
 */

export function renderWebcamModal(targetUser = null) {
  return `
    <div class="modal-overlay" id="webcam-modal">
      <div class="modal-box" style="max-width:680px; background:#000; border:1px solid var(--border); overflow:hidden; position:relative;">
        <div style="position:relative; width:100%; aspect-ratio:16/9; background:#0A0A0A; display:flex; align-items:center; justify-content:center;">
          <video id="webcam-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
          
          <div id="camera-error-message" class="hidden" style="position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center;">
            <i data-lucide="video-off" style="width:48px;height:48px;color:var(--like-red); margin-bottom:12px;"></i>
            <h3 style="font-size:16px; font-weight:700; margin-bottom:8px;">Camera Access Blocked</h3>
            <p style="font-size:13px; color:var(--muted); max-width:360px; margin-bottom:16px;">
              Please allow camera and microphone permissions from your browser settings to continue this video call.
            </p>
            <button class="btn btn-secondary btn-sm" data-action="retry-camera">Retry Permission</button>
          </div>

          <!-- Video call HUD -->
          <div style="position:absolute; top:16px; left:16px; display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.6); padding:6px 12px; border-radius:var(--radius-pill); backdrop-filter:blur(8px);">
            <div class="online-dot" style="position:static;"></div>
            <span style="font-size:12px; font-weight:600;">${targetUser?.username ? `@${targetUser.username}` : 'NoChat Call'}</span>
          </div>
        </div>

        <div style="padding:16px 24px; display:flex; align-items:center; justify-content:center; gap:16px; background:var(--surface); border-top:1px solid var(--border);">
          <button class="btn-icon" data-action="flip-camera" title="Flip Camera (Front/Back)"><i data-lucide="camera-reverse"></i></button>
          <button class="btn-icon" data-action="toggle-mute-mic" title="Mute/Unmute Mic" id="mute-mic-btn"><i data-lucide="mic"></i></button>
          <button class="btn-icon" data-action="toggle-mute-cam" title="Turn Off Video" id="mute-cam-btn"><i data-lucide="video"></i></button>
          <button class="btn btn-danger" data-action="end-call" style="border-radius:24px; height:44px; padding:0 24px;">
            <i data-lucide="phone-off"></i>
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  `;
}
