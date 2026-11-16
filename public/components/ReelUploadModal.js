/**
 * NoChat v4 - Reel Upload Modal with Progress
 */

export function renderReelUploadModal() {
  return `
    <div class="modal-overlay" id="reel-upload-modal">
      <div class="modal-box" style="padding:28px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="font-size:18px; font-weight:700;">Create New Reel</h2>
          <button class="btn-icon" data-action="close-modal"><i data-lucide="x"></i></button>
        </div>

        <form id="reel-upload-form" style="display:flex; flex-direction:column; gap:16px;">
          <div class="form-field">
            <label>Select Reel Video (MP4/WebM, up to 100MB)</label>
            <input type="file" name="video" accept="video/mp4,video/webm,video/quicktime" required style="padding:8px;" />
          </div>

          <div class="form-field">
            <label>Caption</label>
            <textarea name="caption" rows="3" placeholder="Write a caption... (e.g. Vibes at Denpher HQ ⚡)" style="resize:none; padding:10px;"></textarea>
          </div>

          <div id="upload-progress-wrap" class="hidden" style="margin-top:8px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span>Uploading to permanent storage...</span>
              <span id="upload-progress-percent">0%</span>
            </div>
            <div style="width:100%; height:6px; background-color:var(--border); border-radius:3px; overflow:hidden;">
              <div id="upload-progress-bar" style="width:0%; height:100%; background-color:var(--accent-blue); transition:width 150ms ease;"></div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="reel-submit-btn">Share Reel</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
